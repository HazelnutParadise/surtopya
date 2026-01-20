package main

import (
	"log"
	"os"

	"github.com/TimLai666/surtopya-api/internal/database"
	"github.com/TimLai666/surtopya-api/internal/routes"
	"github.com/joho/godotenv"
)

func main() {
	// Load .env file if it exists
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	// Initialize database connection
	dbConfig := database.LoadConfigFromEnv()
	if err := database.Connect(dbConfig); err != nil {
		log.Printf("Warning: Could not connect to database: %v", err)
		log.Println("Starting server without database connection (limited functionality)")
	} else {
		log.Println("Successfully connected to database")
		defer database.Close()
	}

	// Setup router
	router := routes.SetupRouter()

	// Get port from environment or default to 8080
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Starting Surtopya API server on :%s...", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
