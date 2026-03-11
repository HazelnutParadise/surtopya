package main

import (
	"context"
	"log"
	"os"
	"time"

	"github.com/TimLai666/surtopya-api/internal/database"
	"github.com/TimLai666/surtopya-api/internal/platformlog"
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

		go func() {
			runHotSweep := func() {
				hotCount, err := surveyRepo.RecomputeHotSurveysUTC()
				if err != nil {
					log.Printf("Warning: Failed to recompute hot surveys: %v", err)
					return
				}
				log.Printf("Recomputed hot surveys: %d marked hot", hotCount)
			}

			runHotSweep()
			for {
				nowUTC := time.Now().UTC()
				nextRunUTC := time.Date(nowUTC.Year(), nowUTC.Month(), nowUTC.Day(), 0, 5, 0, 0, time.UTC)
				if !nowUTC.Before(nextRunUTC) {
					nextRunUTC = nextRunUTC.Add(24 * time.Hour)
				}

				timer := time.NewTimer(time.Until(nextRunUTC))
				<-timer.C
				runHotSweep()
			}
		}()

		go func() {
			runRetentionSweep := func() {
				deleted, err := platformlog.PurgeOlderThan(context.Background(), database.GetDB(), time.Now().UTC().Add(-180*24*time.Hour))
				if err != nil {
					log.Printf("Warning: Failed to purge platform event logs: %v", err)
					return
				}
				if deleted > 0 {
					log.Printf("Purged %d platform event logs older than 180 days", deleted)
				}
			}

			runRetentionSweep()
			for {
				nowUTC := time.Now().UTC()
				nextRunUTC := time.Date(nowUTC.Year(), nowUTC.Month(), nowUTC.Day(), 1, 0, 0, 0, time.UTC)
				if !nowUTC.Before(nextRunUTC) {
					nextRunUTC = nextRunUTC.Add(24 * time.Hour)
				}
				timer := time.NewTimer(time.Until(nextRunUTC))
				<-timer.C
				runRetentionSweep()
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
