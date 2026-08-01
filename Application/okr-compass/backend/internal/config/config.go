package config

import (
	"os"
	"strconv"
)

type Config struct {
	Port                string
	DBPath              string
	JWTSecret           string
	AdminUser           string
	AdminPassword       string
	EncryptionKey       string
	EvalIntervalMinutes int
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func Load() *Config {
	interval, err := strconv.Atoi(getEnv("EVAL_INTERVAL_MINUTES", "5"))
	if err != nil || interval <= 0 {
		interval = 5
	}

	return &Config{
		Port:                getEnv("PORT", "8080"),
		DBPath:              getEnv("DB_PATH", "./data/okr.db"),
		JWTSecret:           getEnv("JWT_SECRET", "dev-insecure-secret-change-me"),
		AdminUser:           getEnv("ADMIN_USER", "admin"),
		AdminPassword:       getEnv("ADMIN_PASSWORD", "changeme"),
		EncryptionKey:       getEnv("ENCRYPTION_KEY", "dev-insecure-32-byte-key-change!"),
		EvalIntervalMinutes: interval,
	}
}
