package database

type UserContact struct {
	SessionPhone string `gorm:"column:session_phone;index"` // The owner of the contacts
	PN           string `gorm:"column:pn"`                  // Phone Number
	LID          string `gorm:"column:lid"`                 // List ID or Label ID
}

type ContactResult struct {
	PN  string `gorm:"column:pn"`
	LID string `gorm:"column:lid"`
}

// GetContacts returns all pn and lid belonging to the session_phone
func GetContacts(session string) ([]ContactResult, error) {
	var contacts []ContactResult

	err := DB.Model(&UserContact{}).
		Select("pn, lid").
		Where("session_phone = ?", session).
		Find(&contacts).Error

	if err != nil {
		return nil, err
	}

	return contacts, nil
}
