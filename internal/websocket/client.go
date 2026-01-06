package websocket

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/coder/websocket"
)

// Message represents a WebSocket message
type Message struct {
	Type    string `json:"type"`
	From    string `json:"from"`
	To      string `json:"to"`
	Content string `json:"content"`
	Time    string `json:"time"`
}

// Client represents a WebSocket client connection
type Client struct {
	hub  *Hub
	conn *websocket.Conn
	send chan []byte
	ID   string
}

// HandleWebSocket upgrades HTTP connection to WebSocket and handles the connection
func HandleWebSocket(hub *Hub, w http.ResponseWriter, r *http.Request) {
	// Get client ID from query parameter
	clientID := r.URL.Query().Get("id")
	if clientID == "" {
		clientID = "anonymous"
	}

	// Accept WebSocket connection
	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{
		InsecureSkipVerify: true, // Development only
	})
	if err != nil {
		log.Printf("Failed to accept WebSocket connection: %v", err)
		return
	}

	client := &Client{
		hub:  hub,
		conn: conn,
		send: make(chan []byte, 256),
		ID:   clientID,
	}

	// Register client with hub
	client.hub.register <- client

	// Start read and write pumps
	go client.writePump()
	client.readPump()
}

// readPump reads messages from the WebSocket connection
func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close(websocket.StatusNormalClosure, "connection closed")
	}()

	for {
		_, message, err := c.conn.Read(context.Background())
		if err != nil {
			if websocket.CloseStatus(err) != websocket.StatusNormalClosure {
				log.Printf("WebSocket read error for client %s: %v", c.ID, err)
			}
			break
		}

		// Parse and validate message
		var msg Message
		if err := json.Unmarshal(message, &msg); err != nil {
			log.Printf("Failed to parse message from client %s: %v", c.ID, err)
			continue
		}

		// Set timestamp if not provided
		if msg.Time == "" {
			msg.Time = time.Now().Format(time.RFC3339)
		}

		// Set sender if not provided
		if msg.From == "" {
			msg.From = c.ID
		}

		log.Printf("Message from %s: %s", msg.From, msg.Content)

		// Re-serialize with updated fields
		messageBytes, err := json.Marshal(msg)
		if err != nil {
			log.Printf("Failed to marshal message: %v", err)
			continue
		}

		// Broadcast message to all clients
		c.hub.broadcast <- messageBytes
	}
}

// writePump writes messages to the WebSocket connection
func (c *Client) writePump() {
	defer func() {
		c.conn.Close(websocket.StatusNormalClosure, "connection closed")
	}()

	for {
		select {
		case message, ok := <-c.send:
			if !ok {
				// Channel was closed
				return
			}

			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			err := c.conn.Write(ctx, websocket.MessageText, message)
			cancel()

			if err != nil {
				log.Printf("WebSocket write error for client %s: %v", c.ID, err)
				return
			}
		}
	}
}
