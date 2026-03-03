package main

import (
	"log"
	"os"
	"time"

	"github.com/TimLai666/surtopya-api/internal/database"
	"github.com/TimLai666/surtopya-api/internal/repository"
	"github.com/TimLai666/surtopya-api/internal/routes"
)

func main() {
	dbReady := false

	// Initialize database connection
	dbConfig := database.LoadConfigFromEnv()
	if err := database.Connect(dbConfig); err != nil {
		log.Printf("Warning: Could not connect to database: %v", err)
		log.Println("Starting server without database connection (limited functionality)")
	} else {
		dbReady = true
		log.Println("Successfully connected to database")
		if err := database.RunMigrations(); err != nil {
			log.Printf("Warning: Failed to run migrations: %v", err)
		} else {
			log.Println("Database migrations are up to date")
		}
		defer database.Close()
	}

	if dbReady {
		surveyRepo := repository.NewSurveyRepository(database.GetDB())
		go func() {
			runSweep := func() {
				affected, err := surveyRepo.CloseExpiredResponseOpenSurveys()
				if err != nil {
					log.Printf("Warning: Failed to close expired response-open surveys: %v", err)
					return
				}
				if affected > 0 {
					log.Printf("Closed %d expired response-open surveys", affected)
				}
			}

			runSweep()
			ticker := time.NewTicker(1 * time.Minute)
			defer ticker.Stop()
			for range ticker.C {
				runSweep()
			}
		}()
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
