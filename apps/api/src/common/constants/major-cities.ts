// Ported verbatim from the legacy suivi-chauffeur-twilio/server.js catalogues.
// Do not hand-edit values here without checking docs/LEGACY_FEATURES.md §6.
export interface MajorCity {
  name: string;
  country: string;
}

export const MAJOR_CITIES: MajorCity[] = [
  {
    name: 'Kabul',
    country: 'AF',
  },
  {
    name: 'Cape Town',
    country: 'ZA',
  },
  {
    name: 'Johannesburg',
    country: 'ZA',
  },
  {
    name: 'Durban',
    country: 'ZA',
  },
  {
    name: 'Pretoria',
    country: 'ZA',
  },
  {
    name: 'Tirana',
    country: 'AL',
  },
  {
    name: 'Algiers',
    country: 'DZ',
  },
  {
    name: 'Oran',
    country: 'DZ',
  },
  {
    name: 'Berlin',
    country: 'DE',
  },
  {
    name: 'Frankfurt',
    country: 'DE',
  },
  {
    name: 'Hamburg',
    country: 'DE',
  },
  {
    name: 'Munich',
    country: 'DE',
  },
  {
    name: 'Cologne',
    country: 'DE',
  },
  {
    name: 'Düsseldorf',
    country: 'DE',
  },
  {
    name: 'Stuttgart',
    country: 'DE',
  },
  {
    name: 'Leipzig',
    country: 'DE',
  },
  {
    name: 'Andorra la Vella',
    country: 'AD',
  },
  {
    name: 'Luanda',
    country: 'AO',
  },
  {
    name: "St. John's",
    country: 'AG',
  },
  {
    name: 'Riyadh',
    country: 'SA',
  },
  {
    name: 'Jeddah',
    country: 'SA',
  },
  {
    name: 'Mecca',
    country: 'SA',
  },
  {
    name: 'Medina',
    country: 'SA',
  },
  {
    name: 'Dammam',
    country: 'SA',
  },
  {
    name: 'Buenos Aires',
    country: 'AR',
  },
  {
    name: 'Cordoba',
    country: 'AR',
  },
  {
    name: 'Mendoza',
    country: 'AR',
  },
  {
    name: 'Rosario',
    country: 'AR',
  },
  {
    name: 'Yerevan',
    country: 'AM',
  },
  {
    name: 'Sydney',
    country: 'AU',
  },
  {
    name: 'Melbourne',
    country: 'AU',
  },
  {
    name: 'Brisbane',
    country: 'AU',
  },
  {
    name: 'Perth',
    country: 'AU',
  },
  {
    name: 'Canberra',
    country: 'AU',
  },
  {
    name: 'Gold Coast',
    country: 'AU',
  },
  {
    name: 'Vienna',
    country: 'AT',
  },
  {
    name: 'Salzburg',
    country: 'AT',
  },
  {
    name: 'Innsbruck',
    country: 'AT',
  },
  {
    name: 'Baku',
    country: 'AZ',
  },
  {
    name: 'Nassau',
    country: 'BS',
  },
  {
    name: 'Manama',
    country: 'BH',
  },
  {
    name: 'Dhaka',
    country: 'BD',
  },
  {
    name: 'Chittagong',
    country: 'BD',
  },
  {
    name: 'Bridgetown',
    country: 'BB',
  },
  {
    name: 'Brussels',
    country: 'BE',
  },
  {
    name: 'Antwerp',
    country: 'BE',
  },
  {
    name: 'Bruges',
    country: 'BE',
  },
  {
    name: 'Belize City',
    country: 'BZ',
  },
  {
    name: 'Cotonou',
    country: 'BJ',
  },
  {
    name: 'Porto-Novo',
    country: 'BJ',
  },
  {
    name: 'Thimphu',
    country: 'BT',
  },
  {
    name: 'Minsk',
    country: 'BY',
  },
  {
    name: 'Yangon',
    country: 'MM',
  },
  {
    name: 'Mandalay',
    country: 'MM',
  },
  {
    name: 'La Paz',
    country: 'BO',
  },
  {
    name: 'Santa Cruz',
    country: 'BO',
  },
  {
    name: 'Sarajevo',
    country: 'BA',
  },
  {
    name: 'Gaborone',
    country: 'BW',
  },
  {
    name: 'Rio de Janeiro',
    country: 'BR',
  },
  {
    name: 'Sao Paulo',
    country: 'BR',
  },
  {
    name: 'Brasilia',
    country: 'BR',
  },
  {
    name: 'Salvador',
    country: 'BR',
  },
  {
    name: 'Florianopolis',
    country: 'BR',
  },
  {
    name: 'Bandar Seri Begawan',
    country: 'BN',
  },
  {
    name: 'Sofia',
    country: 'BG',
  },
  {
    name: 'Ouagadougou',
    country: 'BF',
  },
  {
    name: 'Bujumbura',
    country: 'BI',
  },
  {
    name: 'Phnom Penh',
    country: 'KH',
  },
  {
    name: 'Siem Reap',
    country: 'KH',
  },
  {
    name: 'Douala',
    country: 'CM',
  },
  {
    name: 'Yaoundé',
    country: 'CM',
  },
  {
    name: 'Toronto',
    country: 'CA',
  },
  {
    name: 'Vancouver',
    country: 'CA',
  },
  {
    name: 'Montreal',
    country: 'CA',
  },
  {
    name: 'Calgary',
    country: 'CA',
  },
  {
    name: 'Ottawa',
    country: 'CA',
  },
  {
    name: 'Whistler',
    country: 'CA',
  },
  {
    name: 'Praia',
    country: 'CV',
  },
  {
    name: 'Santiago',
    country: 'CL',
  },
  {
    name: 'Beijing',
    country: 'CN',
  },
  {
    name: 'Shanghai',
    country: 'CN',
  },
  {
    name: 'Guangzhou',
    country: 'CN',
  },
  {
    name: 'Shenzhen',
    country: 'CN',
  },
  {
    name: 'Chengdu',
    country: 'CN',
  },
  {
    name: 'Hangzhou',
    country: 'CN',
  },
  {
    name: "Xi'an",
    country: 'CN',
  },
  {
    name: 'Nicosia',
    country: 'CY',
  },
  {
    name: 'Limassol',
    country: 'CY',
  },
  {
    name: 'Bogota',
    country: 'CO',
  },
  {
    name: 'Medellin',
    country: 'CO',
  },
  {
    name: 'Cartagena',
    country: 'CO',
  },
  {
    name: 'Moroni',
    country: 'KM',
  },
  {
    name: 'Brazzaville',
    country: 'CG',
  },
  {
    name: 'Kinshasa',
    country: 'CD',
  },
  {
    name: 'Pyongyang',
    country: 'KP',
  },
  {
    name: 'Seoul',
    country: 'KR',
  },
  {
    name: 'Busan',
    country: 'KR',
  },
  {
    name: 'Incheon',
    country: 'KR',
  },
  {
    name: 'San Jose',
    country: 'CR',
  },
  {
    name: 'Abidjan',
    country: 'CI',
  },
  {
    name: 'Yamoussoukro',
    country: 'CI',
  },
  {
    name: 'Zagreb',
    country: 'HR',
  },
  {
    name: 'Dubrovnik',
    country: 'HR',
  },
  {
    name: 'Split',
    country: 'HR',
  },
  {
    name: 'Havana',
    country: 'CU',
  },
  {
    name: 'Copenhagen',
    country: 'DK',
  },
  {
    name: 'Aarhus',
    country: 'DK',
  },
  {
    name: 'Djibouti City',
    country: 'DJ',
  },
  {
    name: 'Roseau',
    country: 'DM',
  },
  {
    name: 'Cairo',
    country: 'EG',
  },
  {
    name: 'Alexandria',
    country: 'EG',
  },
  {
    name: 'Sharm El Sheikh',
    country: 'EG',
  },
  {
    name: 'Hurghada',
    country: 'EG',
  },
  {
    name: 'Abu Dhabi',
    country: 'AE',
  },
  {
    name: 'Dubai',
    country: 'AE',
  },
  {
    name: 'Sharjah',
    country: 'AE',
  },
  {
    name: 'Ras Al Khaimah',
    country: 'AE',
  },
  {
    name: 'Quito',
    country: 'EC',
  },
  {
    name: 'Guayaquil',
    country: 'EC',
  },
  {
    name: 'Asmara',
    country: 'ER',
  },
  {
    name: 'Madrid',
    country: 'ES',
  },
  {
    name: 'Barcelona',
    country: 'ES',
  },
  {
    name: 'Valencia',
    country: 'ES',
  },
  {
    name: 'Seville',
    country: 'ES',
  },
  {
    name: 'Ibiza',
    country: 'ES',
  },
  {
    name: 'Marbella',
    country: 'ES',
  },
  {
    name: 'Palma de Mallorca',
    country: 'ES',
  },
  {
    name: 'Tallinn',
    country: 'EE',
  },
  {
    name: 'Mbabane',
    country: 'SZ',
  },
  {
    name: 'New York',
    country: 'US-NY',
  },
  {
    name: 'Miami',
    country: 'US-NY',
  },
  {
    name: 'Boston',
    country: 'US-NY',
  },
  {
    name: 'Chicago',
    country: 'US-IL',
  },
  {
    name: 'Dallas',
    country: 'US-IL',
  },
  {
    name: 'Houston',
    country: 'US-IL',
  },
  {
    name: 'Denver',
    country: 'US-CO',
  },
  {
    name: 'Phoenix',
    country: 'US-CO',
  },
  {
    name: 'Las Vegas',
    country: 'US-CO',
  },
  {
    name: 'Los Angeles',
    country: 'US-CA',
  },
  {
    name: 'San Francisco',
    country: 'US-CA',
  },
  {
    name: 'Seattle',
    country: 'US-CA',
  },
  {
    name: 'Anchorage',
    country: 'US-AK',
  },
  {
    name: 'Fairbanks',
    country: 'US-AK',
  },
  {
    name: 'Juneau',
    country: 'US-AK',
  },
  {
    name: 'Honolulu',
    country: 'US-HI',
  },
  {
    name: 'Maui',
    country: 'US-HI',
  },
  {
    name: 'Kailua-Kona',
    country: 'US-HI',
  },
  {
    name: 'Addis Ababa',
    country: 'ET',
  },
  {
    name: 'Suva',
    country: 'FJ',
  },
  {
    name: 'Helsinki',
    country: 'FI',
  },
  {
    name: 'Paris',
    country: 'FR',
  },
  {
    name: 'Lyon',
    country: 'FR',
  },
  {
    name: 'Marseille',
    country: 'FR',
  },
  {
    name: 'Nice',
    country: 'FR',
  },
  {
    name: 'Cannes',
    country: 'FR',
  },
  {
    name: 'Bordeaux',
    country: 'FR',
  },
  {
    name: 'Toulouse',
    country: 'FR',
  },
  {
    name: 'Lille',
    country: 'FR',
  },
  {
    name: 'Strasbourg',
    country: 'FR',
  },
  {
    name: 'Nantes',
    country: 'FR',
  },
  {
    name: 'Courchevel',
    country: 'FR',
  },
  {
    name: 'Deauville',
    country: 'FR',
  },
  {
    name: 'Montpellier',
    country: 'FR',
  },
  {
    name: 'Aix-en-Provence',
    country: 'FR',
  },
  {
    name: 'Biarritz',
    country: 'FR',
  },
  {
    name: 'Chamonix',
    country: 'FR',
  },
  {
    name: 'Saint-Tropez',
    country: 'FR',
  },
  {
    name: 'Rennes',
    country: 'FR',
  },
  {
    name: 'Reims',
    country: 'FR',
  },
  {
    name: 'Le Havre',
    country: 'FR',
  },
  {
    name: 'Toulon',
    country: 'FR',
  },
  {
    name: 'Grenoble',
    country: 'FR',
  },
  {
    name: 'Dijon',
    country: 'FR',
  },
  {
    name: 'Angers',
    country: 'FR',
  },
  {
    name: 'Avignon',
    country: 'FR',
  },
  {
    name: 'Saint-Malo',
    country: 'FR',
  },
  {
    name: 'Annecy',
    country: 'FR',
  },
  {
    name: 'Libreville',
    country: 'GA',
  },
  {
    name: 'Banjul',
    country: 'GM',
  },
  {
    name: 'Tbilisi',
    country: 'GE',
  },
  {
    name: 'Accra',
    country: 'GH',
  },
  {
    name: 'Kumasi',
    country: 'GH',
  },
  {
    name: 'Athens',
    country: 'GR',
  },
  {
    name: 'Thessaloniki',
    country: 'GR',
  },
  {
    name: 'Mykonos',
    country: 'GR',
  },
  {
    name: 'Santorini',
    country: 'GR',
  },
  {
    name: "St. George's",
    country: 'GD',
  },
  {
    name: 'Guatemala City',
    country: 'GT',
  },
  {
    name: 'Conakry',
    country: 'GN',
  },
  {
    name: 'Bissau',
    country: 'GW',
  },
  {
    name: 'Malabo',
    country: 'GQ',
  },
  {
    name: 'Georgetown',
    country: 'GY',
  },
  {
    name: 'Port-au-Prince',
    country: 'HT',
  },
  {
    name: 'Tegucigalpa',
    country: 'HN',
  },
  {
    name: 'Hong Kong',
    country: 'HK',
  },
  {
    name: 'Budapest',
    country: 'HU',
  },
  {
    name: 'Debrecen',
    country: 'HU',
  },
  {
    name: 'Majuro',
    country: 'MH',
  },
  {
    name: 'Honiara',
    country: 'SB',
  },
  {
    name: 'Delhi',
    country: 'IN',
  },
  {
    name: 'Mumbai',
    country: 'IN',
  },
  {
    name: 'Bangalore',
    country: 'IN',
  },
  {
    name: 'Goa',
    country: 'IN',
  },
  {
    name: 'Hyderabad',
    country: 'IN',
  },
  {
    name: 'Chennai',
    country: 'IN',
  },
  {
    name: 'Jaipur',
    country: 'IN',
  },
  {
    name: 'Jakarta',
    country: 'ID',
  },
  {
    name: 'Bali',
    country: 'ID',
  },
  {
    name: 'Surabaya',
    country: 'ID',
  },
  {
    name: 'Baghdad',
    country: 'IQ',
  },
  {
    name: 'Erbil',
    country: 'IQ',
  },
  {
    name: 'Tehran',
    country: 'IR',
  },
  {
    name: 'Isfahan',
    country: 'IR',
  },
  {
    name: 'Dublin',
    country: 'IE',
  },
  {
    name: 'Cork',
    country: 'IE',
  },
  {
    name: 'Galway',
    country: 'IE',
  },
  {
    name: 'Reykjavik',
    country: 'IS',
  },
  {
    name: 'Tel Aviv',
    country: 'IL',
  },
  {
    name: 'Jerusalem',
    country: 'IL',
  },
  {
    name: 'Haifa',
    country: 'IL',
  },
  {
    name: 'Milan',
    country: 'IT',
  },
  {
    name: 'Rome',
    country: 'IT',
  },
  {
    name: 'Venice',
    country: 'IT',
  },
  {
    name: 'Florence',
    country: 'IT',
  },
  {
    name: 'Naples',
    country: 'IT',
  },
  {
    name: 'Portofino',
    country: 'IT',
  },
  {
    name: 'Turin',
    country: 'IT',
  },
  {
    name: 'Verona',
    country: 'IT',
  },
  {
    name: 'Lake Como',
    country: 'IT',
  },
  {
    name: 'Kingston',
    country: 'JM',
  },
  {
    name: 'Montego Bay',
    country: 'JM',
  },
  {
    name: 'Tokyo',
    country: 'JP',
  },
  {
    name: 'Osaka',
    country: 'JP',
  },
  {
    name: 'Kyoto',
    country: 'JP',
  },
  {
    name: 'Yokohama',
    country: 'JP',
  },
  {
    name: 'Nagoya',
    country: 'JP',
  },
  {
    name: 'Amman',
    country: 'JO',
  },
  {
    name: 'Almaty',
    country: 'KZ',
  },
  {
    name: 'Astana',
    country: 'KZ',
  },
  {
    name: 'Nairobi',
    country: 'KE',
  },
  {
    name: 'Mombasa',
    country: 'KE',
  },
  {
    name: 'Bishkek',
    country: 'KG',
  },
  {
    name: 'Tarawa',
    country: 'KI',
  },
  {
    name: 'Pristina',
    country: 'XK',
  },
  {
    name: 'Kuwait City',
    country: 'KW',
  },
  {
    name: 'Vientiane',
    country: 'LA',
  },
  {
    name: 'Maseru',
    country: 'LS',
  },
  {
    name: 'Riga',
    country: 'LV',
  },
  {
    name: 'Beirut',
    country: 'LB',
  },
  {
    name: 'Monrovia',
    country: 'LR',
  },
  {
    name: 'Tripoli',
    country: 'LY',
  },
  {
    name: 'Vaduz',
    country: 'LI',
  },
  {
    name: 'Vilnius',
    country: 'LT',
  },
  {
    name: 'Luxembourg City',
    country: 'LU',
  },
  {
    name: 'Macau',
    country: 'MO',
  },
  {
    name: 'Skopje',
    country: 'MK',
  },
  {
    name: 'Antananarivo',
    country: 'MG',
  },
  {
    name: 'Kuala Lumpur',
    country: 'MY',
  },
  {
    name: 'Penang',
    country: 'MY',
  },
  {
    name: 'Langkawi',
    country: 'MY',
  },
  {
    name: 'Lilongwe',
    country: 'MW',
  },
  {
    name: 'Male',
    country: 'MV',
  },
  {
    name: 'Bamako',
    country: 'ML',
  },
  {
    name: 'Valletta',
    country: 'MT',
  },
  {
    name: 'Casablanca',
    country: 'MA',
  },
  {
    name: 'Marrakech',
    country: 'MA',
  },
  {
    name: 'Rabat',
    country: 'MA',
  },
  {
    name: 'Tangier',
    country: 'MA',
  },
  {
    name: 'Port Louis',
    country: 'MU',
  },
  {
    name: 'Nouakchott',
    country: 'MR',
  },
  {
    name: 'Mexico City',
    country: 'MX',
  },
  {
    name: 'Cancun',
    country: 'MX',
  },
  {
    name: 'Guadalajara',
    country: 'MX',
  },
  {
    name: 'Los Cabos',
    country: 'MX',
  },
  {
    name: 'Palikir',
    country: 'FM',
  },
  {
    name: 'Chisinau',
    country: 'MD',
  },
  {
    name: 'Monaco',
    country: 'MC',
  },
  {
    name: 'Ulaanbaatar',
    country: 'MN',
  },
  {
    name: 'Podgorica',
    country: 'ME',
  },
  {
    name: 'Kotor',
    country: 'ME',
  },
  {
    name: 'Maputo',
    country: 'MZ',
  },
  {
    name: 'Windhoek',
    country: 'NA',
  },
  {
    name: 'Yaren',
    country: 'NR',
  },
  {
    name: 'Kathmandu',
    country: 'NP',
  },
  {
    name: 'Managua',
    country: 'NI',
  },
  {
    name: 'Niamey',
    country: 'NE',
  },
  {
    name: 'Lagos',
    country: 'NG',
  },
  {
    name: 'Abuja',
    country: 'NG',
  },
  {
    name: 'Oslo',
    country: 'NO',
  },
  {
    name: 'Bergen',
    country: 'NO',
  },
  {
    name: 'Auckland',
    country: 'NZ',
  },
  {
    name: 'Wellington',
    country: 'NZ',
  },
  {
    name: 'Queenstown',
    country: 'NZ',
  },
  {
    name: 'Muscat',
    country: 'OM',
  },
  {
    name: 'Kampala',
    country: 'UG',
  },
  {
    name: 'Tashkent',
    country: 'UZ',
  },
  {
    name: 'Karachi',
    country: 'PK',
  },
  {
    name: 'Lahore',
    country: 'PK',
  },
  {
    name: 'Islamabad',
    country: 'PK',
  },
  {
    name: 'Ngerulmud',
    country: 'PW',
  },
  {
    name: 'Ramallah',
    country: 'PS',
  },
  {
    name: 'Panama City',
    country: 'PA',
  },
  {
    name: 'Port Moresby',
    country: 'PG',
  },
  {
    name: 'Asuncion',
    country: 'PY',
  },
  {
    name: 'Amsterdam',
    country: 'NL',
  },
  {
    name: 'Rotterdam',
    country: 'NL',
  },
  {
    name: 'The Hague',
    country: 'NL',
  },
  {
    name: 'Lima',
    country: 'PE',
  },
  {
    name: 'Cusco',
    country: 'PE',
  },
  {
    name: 'Manila',
    country: 'PH',
  },
  {
    name: 'Cebu',
    country: 'PH',
  },
  {
    name: 'Boracay',
    country: 'PH',
  },
  {
    name: 'Warsaw',
    country: 'PL',
  },
  {
    name: 'Krakow',
    country: 'PL',
  },
  {
    name: 'Lisbon',
    country: 'PT',
  },
  {
    name: 'Porto',
    country: 'PT',
  },
  {
    name: 'Faro',
    country: 'PT',
  },
  {
    name: 'Doha',
    country: 'QA',
  },
  {
    name: 'Bangui',
    country: 'CF',
  },
  {
    name: 'Santo Domingo',
    country: 'DO',
  },
  {
    name: 'Punta Cana',
    country: 'DO',
  },
  {
    name: 'Prague',
    country: 'CZ',
  },
  {
    name: 'Brno',
    country: 'CZ',
  },
  {
    name: 'Bucharest',
    country: 'RO',
  },
  {
    name: 'Cluj-Napoca',
    country: 'RO',
  },
  {
    name: 'London',
    country: 'GB',
  },
  {
    name: 'Manchester',
    country: 'GB',
  },
  {
    name: 'Edinburgh',
    country: 'GB',
  },
  {
    name: 'Birmingham',
    country: 'GB',
  },
  {
    name: 'Moscow',
    country: 'RU',
  },
  {
    name: 'St. Petersburg',
    country: 'RU',
  },
  {
    name: 'Kigali',
    country: 'RW',
  },
  {
    name: 'Basseterre',
    country: 'KN',
  },
  {
    name: 'San Marino',
    country: 'SM',
  },
  {
    name: 'Kingstown',
    country: 'VC',
  },
  {
    name: 'Castries',
    country: 'LC',
  },
  {
    name: 'San Salvador',
    country: 'SV',
  },
  {
    name: 'Apia',
    country: 'WS',
  },
  {
    name: 'São Tomé',
    country: 'ST',
  },
  {
    name: 'Dakar',
    country: 'SN',
  },
  {
    name: 'Belgrade',
    country: 'RS',
  },
  {
    name: 'Victoria',
    country: 'SC',
  },
  {
    name: 'Freetown',
    country: 'SL',
  },
  {
    name: 'Singapore',
    country: 'SG',
  },
  {
    name: 'Bratislava',
    country: 'SK',
  },
  {
    name: 'Ljubljana',
    country: 'SI',
  },
  {
    name: 'Mogadishu',
    country: 'SO',
  },
  {
    name: 'Khartoum',
    country: 'SD',
  },
  {
    name: 'Juba',
    country: 'SS',
  },
  {
    name: 'Colombo',
    country: 'LK',
  },
  {
    name: 'Stockholm',
    country: 'SE',
  },
  {
    name: 'Gothenburg',
    country: 'SE',
  },
  {
    name: 'Zurich',
    country: 'CH',
  },
  {
    name: 'Geneva',
    country: 'CH',
  },
  {
    name: 'Basel',
    country: 'CH',
  },
  {
    name: 'Lausanne',
    country: 'CH',
  },
  {
    name: 'Gstaad',
    country: 'CH',
  },
  {
    name: 'Zermatt',
    country: 'CH',
  },
  {
    name: 'Paramaribo',
    country: 'SR',
  },
  {
    name: 'Damascus',
    country: 'SY',
  },
  {
    name: 'Dushanbe',
    country: 'TJ',
  },
  {
    name: 'Taipei',
    country: 'TW',
  },
  {
    name: 'Kaohsiung',
    country: 'TW',
  },
  {
    name: 'Dar es Salaam',
    country: 'TZ',
  },
  {
    name: 'Zanzibar',
    country: 'TZ',
  },
  {
    name: "N'Djamena",
    country: 'TD',
  },
  {
    name: 'Bangkok',
    country: 'TH',
  },
  {
    name: 'Phuket',
    country: 'TH',
  },
  {
    name: 'Chiang Mai',
    country: 'TH',
  },
  {
    name: 'Koh Samui',
    country: 'TH',
  },
  {
    name: 'Dili',
    country: 'TL',
  },
  {
    name: 'Lome',
    country: 'TG',
  },
  {
    name: "Nuku'alofa",
    country: 'TO',
  },
  {
    name: 'Port of Spain',
    country: 'TT',
  },
  {
    name: 'Tunis',
    country: 'TN',
  },
  {
    name: 'Ashgabat',
    country: 'TM',
  },
  {
    name: 'Istanbul',
    country: 'TR',
  },
  {
    name: 'Ankara',
    country: 'TR',
  },
  {
    name: 'Bodrum',
    country: 'TR',
  },
  {
    name: 'Antalya',
    country: 'TR',
  },
  {
    name: 'Funafuti',
    country: 'TV',
  },
  {
    name: 'Kyiv',
    country: 'UA',
  },
  {
    name: 'Montevideo',
    country: 'UY',
  },
  {
    name: 'Port Vila',
    country: 'VU',
  },
  {
    name: 'Vatican City',
    country: 'VA',
  },
  {
    name: 'Caracas',
    country: 'VE',
  },
  {
    name: 'Ho Chi Minh City',
    country: 'VN',
  },
  {
    name: 'Hanoi',
    country: 'VN',
  },
  {
    name: "Sana'a",
    country: 'YE',
  },
  {
    name: 'Lusaka',
    country: 'ZM',
  },
  {
    name: 'Harare',
    country: 'ZW',
  },
];
