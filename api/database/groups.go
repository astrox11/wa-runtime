package database

type GroupMetadata struct {
	ID        string `gorm:"column:id;primaryKey;autoIncrement:false"`
	SessionID string `gorm:"column:session_phone;primaryKey;autoIncrement:false"`
	MetaData  string `gorm:"column:metadata;type:text"`
	UpdatedAt string `gorm:"column:updated_at"`
}

type GroupMetaDataResult struct {
	MetaData  string `gorm:"column:metadata"`
	UpdatedAt string `gorm:"column:updated_at"`
}

// GetGroup returns metadata and updated_at for a given group ID and session phone
func GetGroup(session, groupID string) (*GroupMetaDataResult, error) {
	var result GroupMetaDataResult
	err := DB.Model(&GroupMetadata{}).
		Select("metadata, updated_at").
		Where("session_phone = ? AND id = ?", session, groupID).
		First(&result).Error
	if err != nil {
		return nil, err
	}
	return &result, nil
}

func GetAllGroups(session string) (map[string]GroupMetaDataResult, error) {
	var results []struct {
		ID        string `gorm:"column:id"`
		MetaData  string `gorm:"column:metadata"`
		UpdatedAt string `gorm:"column:updated_at"`
	}
	err := DB.Model(&GroupMetadata{}).
		Select("id, metadata, updated_at").
		Where("session_phone = ?", session).
		Find(&results).Error
	if err != nil {
		return nil, err
	}

	resultsMap := make(map[string]GroupMetaDataResult)
	for _, r := range results {
		resultsMap[r.ID] = GroupMetaDataResult{
			MetaData:  r.MetaData,
			UpdatedAt: r.UpdatedAt,
		}
	}

	return resultsMap, nil
}
