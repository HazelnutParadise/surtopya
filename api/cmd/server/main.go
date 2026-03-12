package main

import (
	"context"
	"log"
	"os"
	"sync"
	"time"

	"github.com/TimLai666/surtopya-api/internal/database"
	"github.com/TimLai666/surtopya-api/internal/platformlog"
	"github.com/TimLai666/surtopya-api/internal/repository"
	"github.com/TimLai666/surtopya-api/internal/routes"
)

const dbReconnectInterval = 3 * time.Second

func startDatabaseWorkers() {
	go func() {
		runSweep := func() {
			db := database.GetDB()
			if db == nil {
				return
			}

			surveyRepo := repository.NewSurveyRepository(db)
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
			db := database.GetDB()
			if db == nil {
				return
			}

			surveyRepo := repository.NewSurveyRepository(db)
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
			db := database.GetDB()
			if db == nil {
				return
			}

			deleted, err := platformlog.PurgeOlderThan(context.Background(), db, time.Now().UTC().Add(-180*24*time.Hour))
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

func main() {
	dbConfig := database.LoadConfigFromEnv()
	reconnectCtx := context.Background()
	defer func() { _ = database.Close() }()

	var workersOnce sync.Once
	handleDatabaseConnected := func() {
		log.Println("Successfully connected to database")
		if err := database.RunMigrations(); err != nil {
			log.Printf("Warning: Failed to run migrations: %v", err)
		} else {
			log.Println("Database migrations are up to date")
		}

		workersOnce.Do(startDatabaseWorkers)
	}

	if err := database.Connect(dbConfig); err != nil {
		log.Printf("Warning: Could not connect to database: %v", err)
		log.Println("Starting server without database connection (limited functionality)")
	} else {
		handleDatabaseConnected()
	}

	go startDBReconnectLoop(
		reconnectCtx,
		dbReconnectInterval,
		database.IsReady,
		func() error { return database.Connect(dbConfig) },
		handleDatabaseConnected,
		func(err error) {
			log.Printf("Warning: Could not connect to database: %v", err)
		},
	)

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
