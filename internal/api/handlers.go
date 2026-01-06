package api

// Package api provides HTTP handlers for the REST API endpoints.
// It includes both net/http handlers (used with coder/websocket compatibility)
// and Fiber handlers (for potential future use with Fiber-compatible WebSocket libraries).

import (
	"encoding/json"
	"net/http"

	"github.com/gofiber/fiber/v2"
)

// User represents a user in the system
type User struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Email    string `json:"email"`
	IsOnline bool   `json:"isOnline"`
}

// MessageRecord represents a stored message
type MessageRecord struct {
	ID        string `json:"id"`
	From      string `json:"from"`
	To        string `json:"to"`
	Content   string `json:"content"`
	Timestamp string `json:"timestamp"`
}

// LoginRequest represents a login request body
type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

// LoginResponse represents a login response
type LoginResponse struct {
	Success bool   `json:"success"`
	Token   string `json:"token,omitempty"`
	UserID  string `json:"userId,omitempty"`
	Message string `json:"message,omitempty"`
}

// SendMessageRequest represents a request to send a message
type SendMessageRequest struct {
	From    string `json:"from"`
	To      string `json:"to"`
	Content string `json:"content"`
}

// Mock data
var MockUsers = []User{
	{ID: "user1", Name: "Alice", Email: "alice@example.com", IsOnline: true},
	{ID: "user2", Name: "Bob", Email: "bob@example.com", IsOnline: false},
	{ID: "user3", Name: "Charlie", Email: "charlie@example.com", IsOnline: true},
}

var MockMessages = []MessageRecord{
	{ID: "msg1", From: "user1", To: "user2", Content: "Hello Bob!", Timestamp: "2024-01-01T10:00:00Z"},
	{ID: "msg2", From: "user2", To: "user1", Content: "Hi Alice!", Timestamp: "2024-01-01T10:01:00Z"},
	{ID: "msg3", From: "user1", To: "user3", Content: "Hey Charlie!", Timestamp: "2024-01-01T10:02:00Z"},
}

// Helper function for JSON responses
func jsonResponse(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

// HandleLoginHTTP handles user authentication (net/http handler)
func HandleLoginHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonResponse(w, http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"message": "Invalid request body",
		})
		return
	}

	if req.Username == "" || req.Password == "" {
		jsonResponse(w, http.StatusUnauthorized, map[string]interface{}{
			"success": false,
			"message": "Username and password are required",
		})
		return
	}

	jsonResponse(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"token":   "mock-jwt-token-" + req.Username,
		"userId":  req.Username,
		"message": "Login successful",
	})
}

// HandleUsersHTTP returns a list of users (net/http handler)
func HandleUsersHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	jsonResponse(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"users":   MockUsers,
	})
}

// HandleMessagesHTTP returns message history or sends a message (net/http handler)
func HandleMessagesHTTP(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		jsonResponse(w, http.StatusOK, map[string]interface{}{
			"success":  true,
			"messages": MockMessages,
		})
	case http.MethodPost:
		var req SendMessageRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			jsonResponse(w, http.StatusBadRequest, map[string]interface{}{
				"success": false,
				"message": "Invalid request body",
			})
			return
		}

		if req.From == "" || req.To == "" || req.Content == "" {
			jsonResponse(w, http.StatusBadRequest, map[string]interface{}{
				"success": false,
				"message": "From, To, and Content are required",
			})
			return
		}

		jsonResponse(w, http.StatusCreated, map[string]interface{}{
			"success": true,
			"message": "Message sent successfully",
		})
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

// Login handles user authentication (Fiber handler)
func Login(c *fiber.Ctx) error {
	var req LoginRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(LoginResponse{
			Success: false,
			Message: "Invalid request body",
		})
	}

	// Mock authentication - accept any non-empty credentials
	if req.Username == "" || req.Password == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(LoginResponse{
			Success: false,
			Message: "Username and password are required",
		})
	}

	// Mock successful login
	return c.JSON(LoginResponse{
		Success: true,
		Token:   "mock-jwt-token-" + req.Username,
		UserID:  req.Username,
		Message: "Login successful",
	})
}

// GetUsers returns a list of users (Fiber handler)
func GetUsers(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{
		"success": true,
		"users":   MockUsers,
	})
}

// GetMessages returns message history (Fiber handler)
func GetMessages(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{
		"success":  true,
		"messages": MockMessages,
	})
}

// SendMessage handles sending a new message (Fiber handler)
func SendMessage(c *fiber.Ctx) error {
	var req SendMessageRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Invalid request body",
		})
	}

	if req.From == "" || req.To == "" || req.Content == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "From, To, and Content are required",
		})
	}

	// In a real implementation, this would store the message
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"success": true,
		"message": "Message sent successfully",
	})
}

// SetupRoutes configures all API routes (Fiber)
func SetupRoutes(app *fiber.App) {
	api := app.Group("/api")

	api.Post("/login", Login)
	api.Get("/users", GetUsers)
	api.Get("/messages", GetMessages)
	api.Post("/messages", SendMessage)
}
