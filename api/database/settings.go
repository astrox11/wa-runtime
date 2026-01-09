package database

type UserSettings struct {
	User             string `gorm:"primaryKey;column:user"`
	Language         string `gorm:"default:'en'"`
	Prefix           string `gorm:"default:null"`
	Mode             string `gorm:"default:'private'"`
	Afk              string `gorm:"type:text"`
	BGM              string `gorm:"type:text"`
	AliveMsg         string `gorm:"type:text"`
	Filters          string `gorm:"type:text"`
	AntiMsg          string `gorm:"type:text"`
	AntiWord         string `gorm:"type:text"`
	Antilink         int32  `gorm:"default:0"`
	AntiCall         int32  `gorm:"default:0"`
	AntiDelete       int32  `gorm:"default:0"`
	AntilinkSpam     int32  `gorm:"default:0"`
	WelcomeMsg       string `gorm:"type:text"`
	GoodbyeMsg       string `gorm:"type:text"`
	GroupEvents      int32  `gorm:"default:0"`
	AutoKick         string `gorm:"type:text"`
	Sudo             string `gorm:"type:text"`
	Banned           string `gorm:"type:text"`
	DisabledGroups   int32  `gorm:"default:0"`
	DisabledCommands string `gorm:"type:text"`
}

func GetUserSettings(phone string) (*UserSettings, error) {
	var settings UserSettings

	err := DB.Where(UserSettings{User: phone}).FirstOrCreate(&settings).Error

	if err != nil {
		return nil, err
	}

	return &settings, nil
}

// UpdateUserSetting updates a specific field for a user
func UpdateUserSetting(phone string, column string, value any) error {
	return DB.Model(&UserSettings{}).Where("user = ?", phone).Update(column, value).Error
}

// UpdateFullSettings updates multiple fields at once
func UpdateFullSettings(phone string, updates map[string]any) error {
	return DB.Model(&UserSettings{}).Where("user = ?", phone).Updates(updates).Error
}
