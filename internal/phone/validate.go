package phone

import (
	"regexp"
	"strings"
)

var phoneRegex = regexp.MustCompile(`^\+?[1-9]\d{6,14}$`)

var countryPrefixes = map[string]int{
	"1":   11, // USA/Canada
	"7":   11, // Russia
	"20":  12, // Egypt
	"27":  11, // South Africa
	"30":  12, // Greece
	"31":  11, // Netherlands
	"32":  11, // Belgium
	"33":  11, // France
	"34":  11, // Spain
	"36":  11, // Hungary
	"39":  12, // Italy
	"40":  11, // Romania
	"41":  11, // Switzerland
	"43":  12, // Austria
	"44":  12, // UK
	"45":  10, // Denmark
	"46":  11, // Sweden
	"47":  10, // Norway
	"48":  11, // Poland
	"49":  12, // Germany
	"51":  11, // Peru
	"52":  12, // Mexico
	"53":  10, // Cuba
	"54":  12, // Argentina
	"55":  13, // Brazil
	"56":  11, // Chile
	"57":  12, // Colombia
	"58":  12, // Venezuela
	"60":  11, // Malaysia
	"61":  11, // Australia
	"62":  13, // Indonesia
	"63":  12, // Philippines
	"64":  11, // New Zealand
	"65":  10, // Singapore
	"66":  11, // Thailand
	"81":  12, // Japan
	"82":  12, // South Korea
	"84":  11, // Vietnam
	"86":  13, // China
	"90":  12, // Turkey
	"91":  12, // India
	"92":  12, // Pakistan
	"93":  11, // Afghanistan
	"94":  11, // Sri Lanka
	"95":  11, // Myanmar
	"98":  12, // Iran
	"212": 12, // Morocco
	"213": 12, // Algeria
	"216": 11, // Tunisia
	"218": 12, // Libya
	"220": 10, // Gambia
	"221": 11, // Senegal
	"222": 11, // Mauritania
	"223": 10, // Mali
	"224": 11, // Guinea
	"225": 12, // Ivory Coast
	"226": 10, // Burkina Faso
	"227": 10, // Niger
	"228": 10, // Togo
	"229": 10, // Benin
	"230": 10, // Mauritius
	"231": 10, // Liberia
	"232": 10, // Sierra Leone
	"233": 12, // Ghana
	"234": 13, // Nigeria
	"235": 10, // Chad
	"236": 10, // Central African Republic
	"237": 11, // Cameroon
	"238": 10, // Cape Verde
	"239": 10, // Sao Tome
	"240": 11, // Equatorial Guinea
	"241": 10, // Gabon
	"242": 11, // Congo
	"243": 12, // DRC
	"244": 11, // Angola
	"245": 10, // Guinea-Bissau
	"246": 10, // Diego Garcia
	"247": 7,  // Ascension
	"248": 10, // Seychelles
	"249": 12, // Sudan
	"250": 12, // Rwanda
	"251": 12, // Ethiopia
	"252": 11, // Somalia
	"253": 10, // Djibouti
	"254": 12, // Kenya
	"255": 12, // Tanzania
	"256": 12, // Uganda
	"257": 10, // Burundi
	"258": 12, // Mozambique
	"260": 12, // Zambia
	"261": 12, // Madagascar
	"262": 12, // Reunion
	"263": 12, // Zimbabwe
	"264": 11, // Namibia
	"265": 11, // Malawi
	"266": 10, // Lesotho
	"267": 10, // Botswana
	"268": 10, // Eswatini
	"269": 10, // Comoros
	"290": 7,  // Saint Helena
	"291": 10, // Eritrea
	"297": 10, // Aruba
	"298": 9,  // Faroe Islands
	"299": 9,  // Greenland
	"350": 10, // Gibraltar
	"351": 12, // Portugal
	"352": 11, // Luxembourg
	"353": 11, // Ireland
	"354": 10, // Iceland
	"355": 11, // Albania
	"356": 10, // Malta
	"357": 11, // Cyprus
	"358": 12, // Finland
	"359": 11, // Bulgaria
	"370": 11, // Lithuania
	"371": 11, // Latvia
	"372": 10, // Estonia
	"373": 11, // Moldova
	"374": 11, // Armenia
	"375": 12, // Belarus
	"376": 9,  // Andorra
	"377": 11, // Monaco
	"378": 14, // San Marino
	"380": 12, // Ukraine
	"381": 12, // Serbia
	"382": 12, // Montenegro
	"383": 11, // Kosovo
	"385": 11, // Croatia
	"386": 11, // Slovenia
	"387": 11, // Bosnia
	"389": 11, // North Macedonia
	"420": 12, // Czech Republic
	"421": 12, // Slovakia
	"423": 11, // Liechtenstein
	"500": 8,  // Falkland Islands
	"501": 10, // Belize
	"502": 11, // Guatemala
	"503": 11, // El Salvador
	"504": 11, // Honduras
	"505": 11, // Nicaragua
	"506": 11, // Costa Rica
	"507": 10, // Panama
	"508": 9,  // Saint Pierre
	"509": 11, // Haiti
	"590": 12, // Guadeloupe
	"591": 11, // Bolivia
	"592": 10, // Guyana
	"593": 12, // Ecuador
	"594": 12, // French Guiana
	"595": 12, // Paraguay
	"596": 12, // Martinique
	"597": 10, // Suriname
	"598": 11, // Uruguay
	"599": 11, // Curacao
	"670": 11, // East Timor
	"672": 10, // Norfolk Island
	"673": 10, // Brunei
	"674": 10, // Nauru
	"675": 10, // Papua New Guinea
	"676": 10, // Tonga
	"677": 10, // Solomon Islands
	"678": 10, // Vanuatu
	"679": 10, // Fiji
	"680": 10, // Palau
	"681": 9,  // Wallis
	"682": 8,  // Cook Islands
	"683": 7,  // Niue
	"685": 10, // Samoa
	"686": 10, // Kiribati
	"687": 9,  // New Caledonia
	"688": 8,  // Tuvalu
	"689": 10, // French Polynesia
	"690": 7,  // Tokelau
	"691": 10, // Micronesia
	"692": 10, // Marshall Islands
	"850": 12, // North Korea
	"852": 11, // Hong Kong
	"853": 11, // Macau
	"855": 11, // Cambodia
	"856": 12, // Laos
	"880": 13, // Bangladesh
	"886": 12, // Taiwan
	"960": 10, // Maldives
	"961": 10, // Lebanon
	"962": 12, // Jordan
	"963": 12, // Syria
	"964": 12, // Iraq
	"965": 10, // Kuwait
	"966": 12, // Saudi Arabia
	"967": 12, // Yemen
	"968": 11, // Oman
	"970": 12, // Palestine
	"971": 12, // UAE
	"972": 12, // Israel
	"973": 11, // Bahrain
	"974": 11, // Qatar
	"975": 11, // Bhutan
	"976": 11, // Mongolia
	"977": 13, // Nepal
	"992": 12, // Tajikistan
	"993": 10, // Turkmenistan
	"994": 12, // Azerbaijan
	"995": 12, // Georgia
	"996": 12, // Kyrgyzstan
	"998": 12, // Uzbekistan
}

type ValidationResult struct {
	Valid       bool   `json:"valid"`
	Number      string `json:"number,omitempty"`
	CountryCode string `json:"country_code,omitempty"`
	Error       string `json:"error,omitempty"`
}

func Validate(input string) ValidationResult {
	cleaned := regexp.MustCompile(`[^\d+]`).ReplaceAllString(input, "")

	if !strings.HasPrefix(cleaned, "+") {
		cleaned = "+" + cleaned
	}

	if len(cleaned) < 8 || len(cleaned) > 16 {
		return ValidationResult{
			Valid: false,
			Error: "Phone number must be between 7 and 15 digits",
		}
	}

	digits := strings.TrimPrefix(cleaned, "+")
	if !phoneRegex.MatchString("+" + digits) {
		return ValidationResult{
			Valid: false,
			Error: "Invalid phone number format",
		}
	}

	countryCode := ""
	expectedLen := 0

	for prefixLen := 3; prefixLen >= 1; prefixLen-- {
		if len(digits) >= prefixLen {
			prefix := digits[:prefixLen]
			if expLen, exists := countryPrefixes[prefix]; exists {
				countryCode = prefix
				expectedLen = expLen
				break
			}
		}
	}

	if countryCode == "" {
		return ValidationResult{
			Valid:       true,
			Number:      digits,
			CountryCode: "",
		}
	}

	if len(digits) < expectedLen-2 || len(digits) > expectedLen+2 {
		return ValidationResult{
			Valid: false,
			Error: "Phone number length doesn't match expected length for country",
		}
	}

	return ValidationResult{
		Valid:       true,
		Number:      digits,
		CountryCode: countryCode,
	}
}

func Sanitize(input string) string {
	result := Validate(input)
	if result.Valid {
		return result.Number
	}
	return ""
}

func IsValid(input string) bool {
	return Validate(input).Valid
}
