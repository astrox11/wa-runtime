package database

import (
	"gorm.io/gorm"
	"time"
)

type Session struct {
	ID          int64  `gorm:"primaryKey;autoIncrement:false"`
	Phone       string `gorm:"uniqueIndex;not null"`
	Status      string `gorm:"default:'starting'"` // active, paused, logged_out
	PairingCode string
	CreatedAt   time.Time
	UpdatedAt   time.Time
	DeletedAt   gorm.DeletedAt `gorm:"index"`
}
