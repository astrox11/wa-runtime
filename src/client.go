package main

import (
	"astrobridge/src/utils"
	"context"
	"fmt"
	"os"
	"os/signal"
	"syscall"
	"time"

	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/store/sqlstore"
	"go.mau.fi/whatsmeow/types/events"
	waLog "go.mau.fi/whatsmeow/util/log"

	_ "github.com/mattn/go-sqlite3"
)

func eventHandler(evt any) {
	switch v := evt.(type) {
	case *events.Message:
		fmt.Println("Received a message!", v.Message.GetConversation())
	}
}

func main() {
	ctx := context.Background()
	cfg, err := utils.LoadConfig()
	if err != nil {
		fmt.Println("Error:", err)
		return
	}
	fmt.Println("Loaded config:", cfg)
	fmt.Println("Starting Client...")

	dbLog := waLog.Stdout("Database", "DEBUG", true)
	container, err := sqlstore.New(ctx, "sqlite3", "file:database.db?_foreign_keys=on", dbLog)
	if err != nil {
		panic(err)
	}

	deviceStore, err := container.GetFirstDevice(ctx)
	if err != nil {
		panic(err)
	}

	clientLog := waLog.Stdout("Client", "WARN", true)
	client := whatsmeow.NewClient(deviceStore, clientLog)
	client.AddEventHandler(eventHandler)

	if err := client.Connect(); err != nil {
		panic(err)
	}

	qrCh, _ := client.GetQRChannel(client.BackgroundEventCtx)
	go func() {
		for range qrCh {
		}
	}()

	waitTimeout := 15 * time.Second
	select {
	case <-time.After(waitTimeout):
		if !client.IsConnected() {
			fmt.Fprintf(os.Stderr, "timed out waiting for connection\n")
			client.Disconnect()
			os.Exit(1)
		}
	default:
	}

	if !client.IsLoggedIn() {
		code, err := client.PairPhone(ctx, cfg["NUMBER"], true, whatsmeow.PairClientChrome, "Chrome (Linux)")
		if err != nil {
			fmt.Fprintln(os.Stderr, "PairPhone error:", err)
			client.Disconnect()
			os.Exit(99)
		}
		fmt.Println("Connection Code:", code)
	}

	sigs := make(chan os.Signal, 1)
	signal.Notify(sigs, syscall.SIGINT, syscall.SIGTERM)
	<-sigs

	fmt.Println("Shutting down...")
	time.Sleep(200 * time.Millisecond)
	client.Disconnect()
}
