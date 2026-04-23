package config

import "os"

type Config struct {
	Port       string
	Env        string
	JWTSecret  string
	KubeConfig string
}

func Load() *Config {
	return &Config{
		Port:       getEnv("PORT", "8080"),
		Env:        getEnv("ENV", "production"),
		JWTSecret:  getEnv("JWT_SECRET", "kubevision-super-secret-change-in-prod"),
		KubeConfig: getEnv("KUBECONFIG", ""),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
