package utils

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// LoadConfig reads bridge.config from CWD.
// If missing, it creates it with default values.
// It returns a map[string]string of parsed key/value pairs.
func LoadConfig() (map[string]string, error) {
	cfgPath := filepath.Join(".", "bridge.config")
	config := make(map[string]string)

	// If file doesn't exist → create with defaults
	if _, err := os.Stat(cfgPath); os.IsNotExist(err) {
		defaultContent := `NUMBER=value
env = value
`
		if err := os.WriteFile(cfgPath, []byte(defaultContent), 0644); err != nil {
			return nil, fmt.Errorf("failed to create default config: %w", err)
		}
	}

	// Now open the config file
	file, err := os.Open(cfgPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read config: %w", err)
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())

		// Skip empty or comment lines
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		// Split on the first '=' (supports spaces)
		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 {
			continue
		}

		key := strings.TrimSpace(parts[0])
		val := strings.TrimSpace(parts[1])

		// Strip surrounding quotes if present
		if strings.HasPrefix(val, `"`) && strings.HasSuffix(val, `"`) {
			val = strings.Trim(val, `"`)
		}

		config[key] = val
	}

	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("config scanning error: %w", err)
	}

	return config, nil
}
