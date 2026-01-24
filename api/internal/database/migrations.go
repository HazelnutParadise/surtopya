package database

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

const migrationsTable = "schema_migrations"

// RunMigrations applies SQL files from the migrations directory once per database.
func RunMigrations() error {
	if DB == nil {
		return fmt.Errorf("database connection is not initialized")
	}

	migrationsDir := os.Getenv("MIGRATIONS_DIR")
	if migrationsDir == "" {
		migrationsDir = "./migrations"
	}

	entries, err := os.ReadDir(migrationsDir)
	if err != nil {
		return fmt.Errorf("failed to read migrations directory: %w", err)
	}

	var files []string
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		if strings.HasSuffix(name, ".sql") {
			files = append(files, name)
		}
	}
	sort.Strings(files)

	if err := ensureMigrationsTable(); err != nil {
		return err
	}

	applied, err := getAppliedMigrations()
	if err != nil {
		return err
	}

	for _, file := range files {
		if applied[file] {
			continue
		}

		if file == "001_initial_schema.sql" {
			exists, err := usersTableExists()
			if err != nil {
				return err
			}
			if exists {
				if err := markMigrationApplied(file); err != nil {
					return err
				}
				continue
			}
		}

		path := filepath.Join(migrationsDir, file)
		content, err := os.ReadFile(path)
		if err != nil {
			return fmt.Errorf("failed to read migration %s: %w", file, err)
		}

		tx, err := DB.Begin()
		if err != nil {
			return fmt.Errorf("failed to start migration transaction: %w", err)
		}

		if _, err := tx.Exec(string(content)); err != nil {
			_ = tx.Rollback()
			return fmt.Errorf("failed to apply migration %s: %w", file, err)
		}

		if _, err := tx.Exec(
			fmt.Sprintf("INSERT INTO %s (filename) VALUES ($1)", migrationsTable),
			file,
		); err != nil {
			_ = tx.Rollback()
			return fmt.Errorf("failed to record migration %s: %w", file, err)
		}

		if err := tx.Commit(); err != nil {
			return fmt.Errorf("failed to commit migration %s: %w", file, err)
		}
	}

	return nil
}

func ensureMigrationsTable() error {
	_, err := DB.Exec(fmt.Sprintf(`
		CREATE TABLE IF NOT EXISTS %s (
			filename TEXT PRIMARY KEY,
			applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		)
	`, migrationsTable))
	if err != nil {
		return fmt.Errorf("failed to ensure migrations table: %w", err)
	}
	return nil
}

func getAppliedMigrations() (map[string]bool, error) {
	rows, err := DB.Query(fmt.Sprintf("SELECT filename FROM %s", migrationsTable))
	if err != nil {
		return nil, fmt.Errorf("failed to load applied migrations: %w", err)
	}
	defer rows.Close()

	applied := make(map[string]bool)
	for rows.Next() {
		var filename string
		if err := rows.Scan(&filename); err != nil {
			return nil, fmt.Errorf("failed to scan migration record: %w", err)
		}
		applied[filename] = true
	}

	return applied, nil
}

func markMigrationApplied(filename string) error {
	_, err := DB.Exec(
		fmt.Sprintf("INSERT INTO %s (filename) VALUES ($1) ON CONFLICT DO NOTHING", migrationsTable),
		filename,
	)
	if err != nil {
		return fmt.Errorf("failed to mark migration %s as applied: %w", filename, err)
	}
	return nil
}

func usersTableExists() (bool, error) {
	var exists bool
	err := DB.QueryRow(`
		SELECT EXISTS (
			SELECT 1
			FROM information_schema.tables
			WHERE table_schema = 'public' AND table_name = 'users'
		)
	`).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("failed to check users table: %w", err)
	}
	return exists, nil
}
