package database

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"sync"
	"time"

	_ "github.com/lib/pq"
)

var DB *sql.DB
var dbMu sync.RWMutex

// Config holds database configuration
type Config struct {
	Host     string
	Port     string
	User     string
	Password string
	DBName   string
	SSLMode  string
}

// LoadConfigFromEnv loads database config from environment variables
func LoadConfigFromEnv() Config {
	return Config{
		Host:     getEnv("DB_HOST", "localhost"),
		Port:     getEnv("DB_PORT", "5432"),
		User:     getEnv("DB_USER", "postgres"),
		Password: getEnv("DB_PASSWORD", ""),
		DBName:   getEnv("DB_NAME", "surtopya"),
		SSLMode:  getEnv("DB_SSLMODE", "disable"),
	}
}

// Connect establishes a connection to the database
func Connect(cfg Config) error {
	connStr := fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		cfg.Host, cfg.Port, cfg.User, cfg.Password, cfg.DBName, cfg.SSLMode,
	)

	db, err := sql.Open("postgres", connStr)
	if err != nil {
		return fmt.Errorf("failed to open database connection: %w", err)
	}

	// Configure connection pool
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(10)
	db.SetConnMaxLifetime(5 * time.Minute)

	// Verify connection
	if err = db.Ping(); err != nil {
		_ = db.Close()
		return fmt.Errorf("failed to ping database: %w", err)
	}

	dbMu.Lock()
	prev := DB
	DB = db
	dbMu.Unlock()

	if prev != nil && prev != db {
		_ = prev.Close()
	}

	return nil
}

// Close closes the database connection
func Close() error {
	dbMu.Lock()
	db := DB
	DB = nil
	dbMu.Unlock()

	if db != nil {
		return db.Close()
	}
	return nil
}

// GetDB returns the database connection
func GetDB() *sql.DB {
	dbMu.RLock()
	defer dbMu.RUnlock()
	return DB
}

// IsReady reports whether the current database handle is available.
func IsReady() bool {
	db := GetDB()
	if db == nil {
		return false
	}

	ctx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
	defer cancel()

	return db.PingContext(ctx) == nil
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
