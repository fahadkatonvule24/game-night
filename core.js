(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.GameNightCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const TEAM_PALETTE = [
    { name: 'Team Tangerine', color: '#ef774c' },
    { name: 'Team Mint', color: '#9ebf72' },
    { name: 'Team Lavender', color: '#a38cce' },
    { name: 'Team Ocean', color: '#7ba9c4' },
    { name: 'Team Sunshine', color: '#e8b843' },
    { name: 'Team Rose', color: '#d88da0' },
    { name: 'Team Cocoa', color: '#b28b70' },
    { name: 'Team Teal', color: '#66a69f' }
  ];

  const tabooPrompts = [
    ['Pizza', ['Cheese', 'Slice', 'Dough', 'Pepperoni', 'Italian']],
    ['Birthday', ['Cake', 'Candles', 'Party', 'Age', 'Presents']],
    ['Elephant', ['Trunk', 'Tusks', 'Big', 'Animal', 'Grey']],
    ['Beach', ['Sand', 'Ocean', 'Waves', 'Sun', 'Swim']],
    ['Library', ['Books', 'Read', 'Quiet', 'Borrow', 'Shelves']],
    ['Football', ['Goal', 'Kick', 'Ball', 'Team', 'Sport']],
    ['Rainbow', ['Colours', 'Rain', 'Sky', 'Arc', 'Sun']],
    ['Popcorn', ['Cinema', 'Movie', 'Corn', 'Butter', 'Snack']],
    ['Bicycle', ['Wheels', 'Pedal', 'Ride', 'Handlebars', 'Bike']],
    ['Doctor', ['Hospital', 'Patient', 'Medicine', 'Sick', 'Stethoscope']],
    ['Guitar', ['Strings', 'Music', 'Play', 'Instrument', 'Strum']],
    ['Chocolate', ['Sweet', 'Cocoa', 'Bar', 'Candy', 'Brown']],
    ['Aeroplane', ['Fly', 'Pilot', 'Wings', 'Airport', 'Sky']],
    ['Camera', ['Photo', 'Picture', 'Lens', 'Flash', 'Capture']],
    ['Penguin', ['Bird', 'Ice', 'Antarctica', 'Waddle', 'Black']],
    ['Umbrella', ['Rain', 'Wet', 'Cover', 'Open', 'Weather']],
    ['Swimming pool', ['Water', 'Dive', 'Swim', 'Chlorine', 'Splash']],
    ['Wedding', ['Bride', 'Groom', 'Marriage', 'Ring', 'Ceremony']],
    ['Mountain', ['Climb', 'Peak', 'High', 'Hill', 'Summit']],
    ['Breakfast', ['Morning', 'Meal', 'Eggs', 'Cereal', 'Eat']],
    ['Computer', ['Keyboard', 'Screen', 'Mouse', 'Laptop', 'Internet']],
    ['Firefighter', ['Fire', 'Hose', 'Truck', 'Rescue', 'Flames']],
    ['Telescope', ['Stars', 'Space', 'Look', 'Lens', 'Planets']],
    ['Toothbrush', ['Teeth', 'Paste', 'Brush', 'Mouth', 'Clean']],
    ['Kite', ['Fly', 'Wind', 'String', 'Sky', 'Paper']],
    ['Snowman', ['Snow', 'Carrot', 'Winter', 'Cold', 'Build']],
    ['Suitcase', ['Travel', 'Pack', 'Clothes', 'Luggage', 'Holiday']],
    ['Honey', ['Bee', 'Sweet', 'Hive', 'Sticky', 'Yellow']],
    ['Clock', ['Time', 'Hands', 'Hour', 'Minute', 'Tick']],
    ['Bridge', ['River', 'Cross', 'Road', 'Connect', 'Over']],
    ['Robot', ['Machine', 'Metal', 'Computer', 'Human', 'Program']],
    ['Candle', ['Flame', 'Wax', 'Light', 'Burn', 'Wick']],
    ['Backpack', ['Bag', 'School', 'Straps', 'Carry', 'Shoulders']],
    ['Watermelon', ['Fruit', 'Seeds', 'Green', 'Red', 'Juicy']],
    ['Chess', ['Board', 'King', 'Queen', 'Checkmate', 'Pieces']],
    ['Dance', ['Music', 'Move', 'Rhythm', 'Steps', 'Feet']]
  ];

  // [question, options, answer index, category, level index]
  const triviaPrompts = [
    ['Which planet is known as the Red Planet?', ['Venus', 'Mars', 'Jupiter', 'Mercury'], 1, 'general', 0],
    ['How many sides does a hexagon have?', ['Five', 'Six', 'Seven', 'Eight'], 1, 'general', 0],
    ['Which is the largest ocean on Earth?', ['Atlantic', 'Indian', 'Arctic', 'Pacific'], 3, 'general', 1],
    ['What is the chemical symbol for gold?', ['Ag', 'Gd', 'Au', 'Go'], 2, 'general', 1],
    ['Which animal is the tallest living land animal?', ['Elephant', 'Ostrich', 'Giraffe', 'Camel'], 2, 'animals', 0],
    ['Who wrote Romeo and Juliet?', ['Charles Dickens', 'Jane Austen', 'William Shakespeare', 'Mark Twain'], 2, 'arts', 0],
    ['How many keys does a standard full-size modern piano have?', ['66', '72', '88', '96'], 2, 'arts', 2],
    ['Which gas do plants take in during photosynthesis?', ['Oxygen', 'Carbon dioxide', 'Helium', 'Hydrogen'], 1, 'general', 1],
    ['What is the capital city of Kenya?', ['Mombasa', 'Kisumu', 'Nairobi', 'Nakuru'], 2, 'capitals', 0],
    ['Which continent is the Sahara Desert in?', ['Asia', 'Africa', 'Australia', 'South America'], 1, 'general', 0],
    ['How many players does a football team normally have on the field?', ['Nine', 'Ten', 'Eleven', 'Twelve'], 2, 'general', 0],
    ['Which instrument has black and white keys?', ['Trumpet', 'Violin', 'Flute', 'Piano'], 3, 'arts', 0],
    ['What is the largest organ of the human body?', ['Liver', 'Brain', 'Skin', 'Heart'], 2, 'general', 1],
    ['What do you call a baby frog?', ['Cub', 'Tadpole', 'Calf', 'Chick'], 1, 'animals', 0],
    ['Which of these numbers is prime?', ['21', '27', '29', '33'], 2, 'general', 1],
    ['How many minutes are there in three hours?', ['120', '150', '180', '210'], 2, 'general', 0],
    ['Which planet is closest to the Sun?', ['Earth', 'Venus', 'Mars', 'Mercury'], 3, 'general', 0],
    ['What is the hardest natural mineral?', ['Quartz', 'Diamond', 'Topaz', 'Ruby'], 1, 'general', 1],
    ['Which country is home to the ancient city of Machu Picchu?', ['Mexico', 'Peru', 'Chile', 'Brazil'], 1, 'countries', 1],
    ['Which colour do you get by mixing blue and yellow paint?', ['Orange', 'Purple', 'Green', 'Pink'], 2, 'arts', 0],
    ['How many bones are typically in an adult human skeleton?', ['186', '196', '206', '216'], 2, 'general', 2],
    ['Which animal is known for changing its skin colour?', ['Kangaroo', 'Chameleon', 'Dolphin', 'Penguin'], 1, 'animals', 0],
    ['In which sport would you use a shuttlecock?', ['Squash', 'Tennis', 'Badminton', 'Cricket'], 2, 'general', 1],
    ['What is the main ingredient in hummus?', ['Lentils', 'Chickpeas', 'Potatoes', 'Rice'], 1, 'general', 1],
    ['Which language has the word hola for hello?', ['French', 'German', 'Spanish', 'Italian'], 2, 'general', 0],
    ['What does a thermometer measure?', ['Distance', 'Temperature', 'Speed', 'Weight'], 1, 'general', 0],
    ['Which bird lays the largest eggs of any living bird?', ['Eagle', 'Penguin', 'Ostrich', 'Flamingo'], 2, 'animals', 1],
    ['What is the square root of 144?', ['10', '11', '12', '14'], 2, 'general', 1],
    ['Which ocean lies between Africa and Australia?', ['Atlantic', 'Pacific', 'Arctic', 'Indian'], 3, 'general', 1],
    ['How many strings does a standard violin have?', ['Three', 'Four', 'Five', 'Six'], 1, 'arts', 1],
    ['What is the largest living species of shark?', ['Great white shark', 'Tiger shark', 'Whale shark', 'Hammerhead shark'], 2, 'animals', 1],
    ['Which shape has three sides?', ['Rectangle', 'Triangle', 'Pentagon', 'Circle'], 1, 'general', 0],
    ['What is the freezing point of pure water at standard atmospheric pressure, in Celsius?', ['0 degrees', '10 degrees', '32 degrees', '100 degrees'], 0, 'general', 0],
    ['Who painted the Mona Lisa?', ['Vincent van Gogh', 'Pablo Picasso', 'Leonardo da Vinci', 'Claude Monet'], 2, 'arts', 0],
    ['What is the name of the galaxy containing our Solar System?', ['Andromeda', 'Milky Way', 'Whirlpool', 'Sombrero'], 1, 'general', 1],
    ['Which of these animals is a mammal?', ['Shark', 'Crocodile', 'Dolphin', 'Octopus'], 2, 'animals', 0]
  ];

  const categoryPrompts = [
    'Things you find in a kitchen', 'Animals that live in the ocean',
    'Things that are yellow', 'Countries in Africa',
    'Things you pack for a holiday', 'Foods you can eat with your hands',
    'Sports played with a ball', 'Things that have wheels',
    'Animals with four legs', 'Things you see at the beach',
    'Musical instruments', 'Things that can fly',
    'Fruits', 'Jobs people do',
    'Things you might find in a backpack', 'Things that make a loud noise',
    'Countries beginning with a vowel', 'Things you do before going to bed',
    'Vegetables', 'Things that are round',
    'Things that need electricity', 'Animals that lay eggs',
    'Things you see in a city', 'Ways to travel',
    'Things people collect', 'Things you can wear on your head',
    'Words that start with the letter B', 'Things that are cold',
    'Games you can play without a screen', 'Things found in a garden',
    'Things you can build with', 'Reasons to celebrate',
    'Things made of wood', 'Things you can buy at a bakery',
    'Things you see in the sky', 'Places where you need to be quiet'
  ];

  const choicePrompts = [
    ['Be able to fly', 'Be able to breathe underwater'],
    ['Talk to animals', 'Speak every human language'],
    ['Always have to sing instead of speaking', 'Always have to dance instead of walking'],
    ['Live in a treehouse', 'Live on a houseboat'],
    ['Have a personal chef', 'Have a personal driver'],
    ['Explore outer space', 'Explore the deep ocean'],
    ['Travel 100 years into the past', 'Travel 100 years into the future'],
    ['Eat only sweet breakfasts', 'Eat only savoury breakfasts'],
    ['Have a rewind button for one day', 'Have a pause button for one hour'],
    ['Always win at board games', 'Always find the perfect gift'],
    ['Go on a road trip with no plan', 'Go on a perfectly planned holiday'],
    ['Have a pet dragon the size of a cat', 'Have a pet cat the size of a dragon'],
    ['Be the best dancer in the room', 'Be the best storyteller in the room'],
    ['Have unlimited books', 'Have unlimited music'],
    ['Spend a week camping in the mountains', 'Spend a week relaxing by the sea'],
    ['Only be able to whisper', 'Only be able to speak very loudly'],
    ['Always have matching socks', 'Never lose your keys again'],
    ['Win a cooking competition', 'Win a talent show'],
    ['Meet your favourite fictional character', 'Visit your favourite fictional place'],
    ['Have an extra hour every morning', 'Have an extra hour every evening'],
    ['Remember every name you hear', 'Remember every song lyric you hear'],
    ['Have pizza for every celebration', 'Have cake for every celebration'],
    ['Be able to teleport anywhere', 'Be able to become invisible for ten minutes'],
    ['Live somewhere it is always sunny', 'Live somewhere with all four seasons'],
    ['Take amazing photographs', 'Draw amazing pictures'],
    ['Have a surprise party thrown for you', 'Plan a surprise party for a friend'],
    ['Be a brilliant drummer', 'Be a brilliant pianist'],
    ['Have a tiny elephant as a friend', 'Have a giant butterfly as a friend'],
    ['Only watch comedies for a year', 'Only watch adventures for a year'],
    ['Invent a new sport', 'Invent a new dessert'],
    ['Have perfect weather on every trip', 'Have no queues on every trip'],
    ['Always know the best joke', 'Always know the best snack to bring'],
    ['Learn a new skill instantly', 'Have the patience to master any skill'],
    ['Host game night every week', 'Be the guest at game night every week'],
    ['Have a picnic in a forest', 'Have a picnic on a rooftop'],
    ['Be able to shrink to the size of a coin', 'Be able to grow as tall as a house']
  ];

  const LEVELS = ['easy', 'medium', 'hard'];
  const PROMPTS_PER_LEVEL = 4;
  const labels = {
    capitals: 'Capital cities', countries: 'Countries', animals: 'Animals', artists: 'Artists & musicians',
    everyday: 'Everyday & actions', places: 'Places', objects: 'Objects', food: 'Food',
    arts: 'Arts & entertainment', general: 'General knowledge', geography: 'Geography', uganda: 'Uganda', africa: 'Africa',
    sports: 'Sports', science: 'Science & space', history: 'World history',
    entertainment: 'Entertainment', characters: 'Fictional characters', occupations: 'Jobs & occupations',
    films: 'Films & shows', phrases: 'Sayings & phrases',
    mixed: 'Mixed bag', house: 'House words'
  };

  // Levels are deliberately curated, rather than assigned randomly at play time.
  const charadesTopics = {
    capitals: [
      ['Paris', 'London', 'Nairobi', 'Kampala', 'Cairo', 'Tokyo'],
      ['Rome', 'Beijing', 'Madrid', 'Washington, D.C.', 'Athens', 'New Delhi'],
      ['Canberra', 'Ottawa', 'Reykjavik', 'Ulaanbaatar', 'Antananarivo', 'Buenos Aires']
    ],
    countries: [
      ['Kenya', 'Uganda', 'Egypt', 'France', 'Japan', 'Brazil'],
      ['Tanzania', 'Italy', 'Australia', 'India', 'Jamaica', 'China'],
      ['Iceland', 'Madagascar', 'Mongolia', 'Switzerland', 'New Zealand', 'Bhutan']
    ],
    animals: [
      ['Lion', 'Elephant', 'Monkey', 'Dog', 'Cat', 'Snake'],
      ['Giraffe', 'Penguin', 'Kangaroo', 'Gorilla', 'Crocodile', 'Ostrich'],
      ['Chameleon', 'Platypus', 'Meerkat', 'Praying mantis', 'Sloth', 'Peacock']
    ],
    artists: [
      ['Michael Jackson', 'Beyoncé', 'Bob Marley', 'Shakira', 'Elvis Presley', 'Taylor Swift'],
      ['Burna Boy', 'Rihanna', 'Wizkid', 'Diamond Platnumz', 'Davido', 'Adele'],
      ['Angélique Kidjo', 'Yemi Alade', 'Sauti Sol', 'Fela Kuti', 'Freddie Mercury', 'Stevie Wonder']
    ],
    everyday: [
      ['Brushing your teeth', 'Taking a group selfie', 'Making pancakes', 'Eating something very spicy', 'Riding a roller coaster', 'Scoring the winning goal', 'Bowling a strike', 'Learning to ride a bicycle', 'Getting caught in the rain', 'Blowing up a giant balloon', 'A cat chasing a laser pointer', 'A frog catching a fly'],
      ['Walking a very excited dog', 'Opening a stubborn jar', 'Decorating a birthday cake', 'A giraffe drinking water', 'A squirrel hiding a nut', 'An elephant having a shower', 'Walking on a tightrope', 'Lifting an extremely heavy weight', 'An astronaut walking on the moon', 'A pirate finding buried treasure', 'Carrying too many shopping bags', 'Trying to stay awake in class'],
      ['Trying to fold a fitted sheet', 'Looking for your glasses while wearing them', 'A penguin learning to fly', 'Playing tennis in slow motion', 'Escaping from a room full of balloons', 'A robot learning to dance', 'A magician losing their rabbit', 'A superhero with a stuck cape', 'Conducting an invisible orchestra', 'A detective following footprints', 'A mime trapped in a box', 'Dancing at a silent disco']
    ]
  };

  const drawingTopics = {
    animals: [
      ['A cat', 'A fish', 'A snake', 'A butterfly', 'A rabbit', 'A lion'],
      ['A giraffe', 'An octopus', 'A kangaroo', 'A flamingo', 'A crocodile', 'A penguin'],
      ['A chameleon on a branch', 'A peacock with its tail open', 'A platypus', 'A praying mantis', 'A hedgehog curled up', 'A jellyfish under the sea']
    ],
    places: [
      ['A house', 'A beach', 'A school', 'A mountain', 'A football pitch', 'A farm'],
      ['A lighthouse', 'An airport', 'A treehouse', 'A train station', 'A campsite', 'A zoo'],
      ['A castle with a moat', 'An underwater city', 'A crowded market', 'An amusement park', 'A space station', 'A village on a mountainside']
    ],
    objects: [
      ['An umbrella', 'A clock', 'A chair', 'A pencil', 'A pair of sunglasses', 'A balloon'],
      ['A bicycle', 'A guitar', 'A camera', 'A treasure chest', 'A sewing machine', 'A telescope'],
      ['A mechanical clock with exposed gears', 'A folded paper crane', 'A spiral staircase', 'A ship in a bottle', 'A hot-air balloon landing', 'A robot making pancakes']
    ],
    food: [
      ['A banana', 'A fried egg', 'A pizza slice', 'An ice cream cone', 'A carrot', 'A birthday cake'],
      ['A stack of pancakes', 'A burger with layers', 'A bowl of noodles', 'A pineapple', 'A bunch of grapes', 'A plate of spaghetti'],
      ['A sushi platter', 'A layered wedding cake', 'A croissant', 'A sizzling barbecue', 'A chef tossing pizza dough', 'A picnic basket spilling fruit']
    ]
  };

  const fastTopics = {
    animals: [
      ['farm animals', 'pets', 'animals with four legs', 'birds', 'animals that swim', 'animals bigger than a cat'],
      ['animals that lay eggs', 'animals with stripes', 'animals with horns', 'animals that live in the desert', 'animals with shells', 'animals that hibernate'],
      ['flightless birds', 'egg-laying animals that are not birds', 'marsupials', 'animals with prehensile tails', 'venomous animals', 'nocturnal mammals']
    ],
    geography: [
      ['countries in Africa', 'capital cities', 'continents', 'countries in Europe', 'countries in Asia', 'things you find at a beach'],
      ['landlocked countries', 'African capital cities', 'island countries', 'countries that begin with S', 'European capital cities', 'countries crossed by the equator'],
      ['capital cities beginning with B', 'countries bordering Tanzania', 'South American capital cities', 'landlocked African countries', 'countries bordering the Mediterranean Sea', 'countries that border exactly two other countries']
    ],
    entertainment: [
      ['musical instruments', 'superheroes', 'animated films', 'singers', 'things in a cinema', 'types of dance'],
      ['African musicians', 'bands with more than two members', 'Disney villains', 'string instruments', 'films with an animal in the title', 'sports played indoors'],
      ['woodwind instruments', 'Shakespeare plays', 'fictional detectives', 'musicians known for playing the piano', 'animated films released before 2000', 'African authors']
    ],
    everyday: [
      ['fruits', 'things in a kitchen', 'colours', 'things you wear', 'things with wheels', 'breakfast foods'],
      ['things you can recycle', 'jobs that involve a uniform', 'foods made from milk', 'things measured in litres', 'things that come in pairs', 'words ending in ing'],
      ['palindromes', 'words with a silent first letter', 'things measured in degrees', 'English words containing three consecutive vowels', 'materials that conduct electricity', 'jobs that use a microscope']
    ]
  };

  const identityTopics = {
    animals: [
      ['Lion', 'Elephant', 'Dog', 'Cat', 'Monkey', 'Giraffe'],
      ['Penguin', 'Kangaroo', 'Dolphin', 'Crocodile', 'Ostrich', 'Gorilla'],
      ['Platypus', 'Pangolin', 'Axolotl', 'Chameleon', 'Meerkat', 'Okapi']
    ],
    artists: [
      ['Michael Jackson', 'Beyoncé', 'Bob Marley', 'Taylor Swift', 'Rihanna', 'Shakira'],
      ['Burna Boy', 'Wizkid', 'Diamond Platnumz', 'Adele', 'Ed Sheeran', 'Davido'],
      ['Angélique Kidjo', 'Fela Kuti', 'Miriam Makeba', 'Freddie Mercury', 'Stevie Wonder', 'Youssou N’Dour']
    ],
    characters: [
      ['Spider-Man', 'Batman', 'Superman', 'Mickey Mouse', 'SpongeBob SquarePants', 'Shrek'],
      ['Harry Potter', 'Elsa from Frozen', 'Simba', 'Wonder Woman', 'Sherlock Holmes', 'Darth Vader'],
      ['Gandalf', 'Mary Poppins', 'Willy Wonka', 'Katniss Everdeen', 'Hercule Poirot', 'The Mad Hatter']
    ],
    occupations: [
      ['Teacher', 'Doctor', 'Chef', 'Farmer', 'Footballer', 'Police officer'],
      ['Pilot', 'Dentist', 'Firefighter', 'Photographer', 'Mechanic', 'Astronaut'],
      ['Archaeologist', 'Cartographer', 'Marine biologist', 'Orchestra conductor', 'Meteorologist', 'Forensic scientist']
    ]
  };

  const extraTrivia = {
    capitals: [
      [
        ['What is the capital of Uganda?', ['Jinja', 'Kampala', 'Entebbe', 'Gulu'], 1],
        ['What is the capital of France?', ['Lyon', 'Nice', 'Paris', 'Marseille'], 2],
        ['What is the capital of Egypt?', ['Cairo', 'Alexandria', 'Luxor', 'Giza'], 0],
        ['What is the capital of the United Kingdom?', ['Manchester', 'Cardiff', 'Edinburgh', 'London'], 3]
      ],
      [
        ['Which city is the capital of Ghana?', ['Kumasi', 'Accra', 'Tamale', 'Cape Coast'], 1],
        ['Which city is the capital of Australia?', ['Sydney', 'Melbourne', 'Canberra', 'Perth'], 2],
        ['Which city is the capital of Canada?', ['Toronto', 'Vancouver', 'Montreal', 'Ottawa'], 3],
        ['Which city is the capital of Tanzania?', ['Dar es Salaam', 'Dodoma', 'Arusha', 'Mwanza'], 1]
      ],
      [
        ['Ulaanbaatar is the capital of which country?', ['Mongolia', 'Kazakhstan', 'Nepal', 'Bhutan'], 0],
        ['Reykjavik is the capital of which country?', ['Norway', 'Iceland', 'Finland', 'Denmark'], 1],
        ['Ljubljana is the capital of which country?', ['Slovakia', 'Croatia', 'Slovenia', 'Serbia'], 2],
        ['Windhoek is the capital of which country?', ['Botswana', 'Zambia', 'Zimbabwe', 'Namibia'], 3]
      ]
    ],
    countries: [
      [
        ['In which country would you find Mount Fuji?', ['China', 'Japan', 'Thailand', 'Vietnam'], 1],
        ['Which country is home to the Taj Mahal?', ['India', 'Pakistan', 'Bangladesh', 'Nepal'], 0],
        ['The pyramids at Giza are in which country?', ['Morocco', 'Sudan', 'Egypt', 'Tunisia'], 2],
        ['The Eiffel Tower is in which country?', ['Italy', 'Spain', 'Germany', 'France'], 3]
      ],
      [
        ['Angkor Wat is in which country?', ['Thailand', 'Cambodia', 'Laos', 'Vietnam'], 1],
        ['The ancient city of Petra is in which country?', ['Jordan', 'Lebanon', 'Egypt', 'Türkiye'], 0],
        ['Mount Kilimanjaro is in which country?', ['Kenya', 'Uganda', 'Tanzania', 'Rwanda'], 2],
        ['Chichén Itzá is in which country?', ['Peru', 'Guatemala', 'Belize', 'Mexico'], 3]
      ],
      [
        ['Lake Bled is in which country?', ['Slovakia', 'Slovenia', 'Austria', 'Croatia'], 1],
        ['The historic city of Samarkand is in which country?', ['Uzbekistan', 'Kazakhstan', 'Kyrgyzstan', 'Tajikistan'], 0],
        ['The Salar de Uyuni salt flat is in which country?', ['Chile', 'Argentina', 'Bolivia', 'Peru'], 2],
        ['The ancient city of Persepolis is in which present-day country?', ['Iraq', 'Greece', 'Egypt', 'Iran'], 3]
      ]
    ],
    animals: [
      [
        ['Which of these animals has a trunk?', ['Giraffe', 'Elephant', 'Zebra', 'Rhino'], 1],
        ['Which animal is famous for its black and white stripes?', ['Zebra', 'Leopard', 'Lion', 'Cheetah'], 0],
        ['What is a baby dog called?', ['Calf', 'Cub', 'Puppy', 'Foal'], 2],
        ['Which of these animals is an insect?', ['Spider', 'Worm', 'Snail', 'Butterfly'], 3]
      ],
      [
        ['Which of these animals is a marsupial?', ['Rabbit', 'Kangaroo', 'Fox', 'Otter'], 1],
        ['How many arms does an octopus have?', ['Eight', 'Six', 'Ten', 'Four'], 0],
        ['Which group do frogs belong to?', ['Reptiles', 'Mammals', 'Amphibians', 'Birds'], 2],
        ['Which bird is known for its ability to fly backwards?', ['Eagle', 'Ostrich', 'Flamingo', 'Hummingbird'], 3]
      ],
      [
        ['Which of these mammals lays eggs?', ['Otter', 'Platypus', 'Beaver', 'Seal'], 1],
        ['What is the largest living species of lizard?', ['Komodo dragon', 'Green iguana', 'Nile monitor', 'Gila monster'], 0],
        ['How many hearts does an octopus have?', ['One', 'Two', 'Three', 'Four'], 2],
        ['Which animal is the closest living relative of the giraffe?', ['Zebra', 'Camel', 'Antelope', 'Okapi'], 3]
      ]
    ],
    arts: [
      [
        ['Which instrument is played with drumsticks?', ['Flute', 'Drum', 'Harp', 'Violin'], 1],
        ['Which fictional hero is also known as the Dark Knight?', ['Batman', 'Superman', 'Spider-Man', 'Thor'], 0],
        ['Which animated film features Simba?', ['Frozen', 'Shrek', 'The Lion King', 'Toy Story'], 2],
        ['Which colour is made by mixing red and white paint?', ['Purple', 'Orange', 'Brown', 'Pink'], 3]
      ],
      [
        ['Which artist is closely associated with the song Thriller?', ['Prince', 'Michael Jackson', 'Elvis Presley', 'Stevie Wonder'], 1],
        ['Who painted The Starry Night?', ['Vincent van Gogh', 'Pablo Picasso', 'Claude Monet', 'Salvador Dalí'], 0],
        ['Which country was reggae musician Bob Marley from?', ['Barbados', 'Trinidad and Tobago', 'Jamaica', 'Cuba'], 2],
        ['Who wrote the Harry Potter novels?', ['J. R. R. Tolkien', 'Roald Dahl', 'C. S. Lewis', 'J. K. Rowling'], 3]
      ],
      [
        ['Who wrote the novel Things Fall Apart?', ['Wole Soyinka', 'Chinua Achebe', 'Ngũgĩ wa Thiong’o', 'Ben Okri'], 1],
        ['Who painted Guernica?', ['Pablo Picasso', 'Henri Matisse', 'Joan Miró', 'Paul Klee'], 0],
        ['Which composer wrote the ballet Swan Lake?', ['Mozart', 'Beethoven', 'Tchaikovsky', 'Chopin'], 2],
        ['Which artist is known for the painting The Persistence of Memory?', ['René Magritte', 'Frida Kahlo', 'Georgia O’Keeffe', 'Salvador Dalí'], 3]
      ]
    ],
    general: [
      [
        ['How many days are in a week?', ['Five', 'Seven', 'Eight', 'Ten'], 1],
        ['Which direction does the Sun appear to rise from?', ['East', 'West', 'North', 'South'], 0],
        ['What is 9 multiplied by 6?', ['45', '63', '54', '56'], 2],
        ['Which part of a plant normally absorbs water from soil?', ['Flower', 'Leaf', 'Fruit', 'Root'], 3]
      ],
      [
        ['What is the chemical symbol for iron?', ['Ir', 'Fe', 'In', 'I'], 1],
        ['How many degrees are in a right angle?', ['90', '45', '180', '360'], 0],
        ['Which force keeps planets in orbit around the Sun?', ['Friction', 'Magnetism', 'Gravity', 'Buoyancy'], 2],
        ['What is the term for a word that reads the same forwards and backwards?', ['Synonym', 'Anagram', 'Acronym', 'Palindrome'], 3]
      ],
      [
        ['Which element has atomic number 6?', ['Oxygen', 'Carbon', 'Nitrogen', 'Boron'], 1],
        ['What is the sum of the interior angles of a pentagon?', ['540 degrees', '360 degrees', '720 degrees', '900 degrees'], 0],
        ['What is the SI unit of electrical resistance?', ['Volt', 'Ampere', 'Ohm', 'Watt'], 2],
        ['What name is given to the process by which a solid changes directly into a gas?', ['Condensation', 'Evaporation', 'Freezing', 'Sublimation'], 3]
      ]
    ]
  };

  // Extra questions so every category has at least ten per level: one full Trivia team round each.
  const moreTrivia = {
    general: [[], [], [
      ['Which planet has the shortest day, spinning fastest on its axis?', ['Saturn', 'Jupiter', 'Neptune', 'Earth'], 1],
      ['What is the most abundant gas in Earth’s atmosphere?', ['Oxygen', 'Carbon dioxide', 'Argon', 'Nitrogen'], 3],
      ['Who proposed the theory of general relativity?', ['Albert Einstein', 'Isaac Newton', 'Niels Bohr', 'Galileo Galilei'], 0],
      ['How many sides does a dodecagon have?', ['Ten', 'Eleven', 'Twelve', 'Twenty'], 2],
      ['Which blood type is known as the universal donor for red blood cells?', ['AB positive', 'O negative', 'A positive', 'B negative'], 1]
    ]],
    animals: [
      [
        ['What do bees make?', ['Milk', 'Honey', 'Silk', 'Butter'], 1],
        ['Which animal is known as the King of the Jungle?', ['Tiger', 'Bear', 'Lion', 'Wolf'], 2]
      ],
      [
        ['What is the fastest land animal?', ['Lion', 'Cheetah', 'Horse', 'Greyhound'], 1],
        ['What is a group of lions called?', ['A pack', 'A herd', 'A pride', 'A flock'], 2],
        ['Which animal is the largest mammal on Earth?', ['Blue whale', 'African elephant', 'Giraffe', 'Hippopotamus'], 0],
        ['How many legs does a spider have?', ['Six', 'Ten', 'Twelve', 'Eight'], 3]
      ],
      [
        ['What is a group of crows called?', ['A murder', 'A parliament', 'A gaggle', 'A pod'], 0],
        ['Which land mammal has the longest pregnancy?', ['Giraffe', 'Rhino', 'African elephant', 'Hippopotamus'], 2],
        ['Which continent has no native land snakes?', ['Australia', 'Antarctica', 'Europe', 'South America'], 1],
        ['What does a herpetologist study?', ['Birds', 'Insects', 'Reptiles and amphibians', 'Fish'], 2],
        ['Which bird has the largest wingspan of any living bird?', ['Andean condor', 'Wandering albatross', 'Bald eagle', 'Great white pelican'], 1],
        ['What colour is a polar bear’s skin?', ['White', 'Pink', 'Grey', 'Black'], 3]
      ]
    ],
    arts: [
      [
        ['Which superhero is known for shooting webs?', ['Spider-Man', 'Iron Man', 'Hulk', 'Aquaman'], 0],
        ['How many strings does a standard guitar have?', ['Four', 'Five', 'Six', 'Eight'], 2]
      ],
      [
        ['Which author created the detective Sherlock Holmes?', ['Agatha Christie', 'Arthur Conan Doyle', 'Charles Dickens', 'Edgar Allan Poe'], 1],
        ['Which band recorded the album Abbey Road?', ['The Rolling Stones', 'Queen', 'The Beatles', 'Pink Floyd'], 2],
        ['In which city is the Louvre museum?', ['Rome', 'Madrid', 'London', 'Paris'], 3],
        ['Who composed the Moonlight Sonata?', ['Ludwig van Beethoven', 'Johann Sebastian Bach', 'Frédéric Chopin', 'Franz Liszt'], 0],
        ['Which singer is often called the Queen of Pop?', ['Whitney Houston', 'Madonna', 'Beyoncé', 'Mariah Carey'], 1]
      ],
      [
        ['Which Nigerian writer won the Nobel Prize in Literature in 1986?', ['Chinua Achebe', 'Wole Soyinka', 'Chimamanda Ngozi Adichie', 'Ben Okri'], 1],
        ['Who sculpted the statue of David in Florence’s Accademia gallery?', ['Donatello', 'Bernini', 'Michelangelo', 'Raphael'], 2],
        ['Who composed the opera La Traviata?', ['Giuseppe Verdi', 'Giacomo Puccini', 'Richard Wagner', 'Gioachino Rossini'], 0],
        ['In which year was James Cameron’s film Titanic released?', ['1994', '1995', '1999', '1997'], 3],
        ['Which art movement is Claude Monet most associated with?', ['Cubism', 'Surrealism', 'Impressionism', 'Baroque'], 2]
      ]
    ],
    capitals: [
      [
        ['What is the capital of Japan?', ['Osaka', 'Tokyo', 'Kyoto', 'Hiroshima'], 1],
        ['What is the capital of Italy?', ['Rome', 'Milan', 'Venice', 'Naples'], 0],
        ['What is the capital of Spain?', ['Barcelona', 'Seville', 'Madrid', 'Valencia'], 2],
        ['What is the capital of the United States?', ['New York City', 'Los Angeles', 'Chicago', 'Washington, D.C.'], 3],
        ['What is the capital of Germany?', ['Munich', 'Berlin', 'Hamburg', 'Frankfurt'], 1]
      ],
      [
        ['Which city is the capital of Brazil?', ['Rio de Janeiro', 'São Paulo', 'Brasília', 'Salvador'], 2],
        ['Which city is the capital of Nigeria?', ['Lagos', 'Abuja', 'Kano', 'Ibadan'], 1],
        ['Which city is the capital of Türkiye?', ['Ankara', 'Istanbul', 'Izmir', 'Antalya'], 0],
        ['Which city is the capital of South Korea?', ['Busan', 'Incheon', 'Daegu', 'Seoul'], 3],
        ['Which city is the capital of Ethiopia?', ['Addis Ababa', 'Mekelle', 'Gondar', 'Dire Dawa'], 0],
        ['Which city is the capital of Rwanda?', ['Huye', 'Rubavu', 'Kigali', 'Musanze'], 2]
      ],
      [
        ['Thimphu is the capital of which country?', ['Nepal', 'Bhutan', 'Myanmar', 'Laos'], 1],
        ['Tbilisi is the capital of which country?', ['Georgia', 'Armenia', 'Azerbaijan', 'Moldova'], 0],
        ['Asmara is the capital of which country?', ['Djibouti', 'Somalia', 'Eritrea', 'South Sudan'], 2],
        ['Paramaribo is the capital of which country?', ['Guyana', 'Venezuela', 'Belize', 'Suriname'], 3],
        ['Vientiane is the capital of which country?', ['Cambodia', 'Laos', 'Vietnam', 'Thailand'], 1],
        ['What is the capital of Kazakhstan?', ['Astana', 'Almaty', 'Shymkent', 'Karaganda'], 0]
      ]
    ],
    countries: [
      [
        ['Which country is shaped like a boot?', ['Greece', 'Italy', 'Portugal', 'Croatia'], 1],
        ['Kangaroos are native to which country?', ['Australia', 'New Zealand', 'South Africa', 'Brazil'], 0],
        ['Which country has a red maple leaf on its flag?', ['United States', 'Norway', 'Canada', 'Sweden'], 2],
        ['The Great Wall was built mainly in which country?', ['Japan', 'Mongolia', 'South Korea', 'China'], 3],
        ['The city of Rio de Janeiro is in which country?', ['Argentina', 'Brazil', 'Mexico', 'Colombia'], 1],
        ['Which country is known as the Land of the Rising Sun?', ['Japan', 'China', 'South Korea', 'Thailand'], 0]
      ],
      [
        ['Serengeti National Park is in which country?', ['Kenya', 'Uganda', 'Tanzania', 'Zambia'], 2],
        ['Which country has the largest population in Africa?', ['Egypt', 'Ethiopia', 'South Africa', 'Nigeria'], 3],
        ['Which is the largest country in the world by area?', ['Canada', 'Russia', 'China', 'United States'], 1],
        ['Honshu, Hokkaido, Kyushu and Shikoku are the main islands of which country?', ['Japan', 'Philippines', 'Indonesia', 'Malaysia'], 0],
        ['Geirangerfjord is in which country?', ['Iceland', 'Sweden', 'Finland', 'Norway'], 3]
      ],
      [
        ['Which is the smallest country in the world by area?', ['Monaco', 'Vatican City', 'San Marino', 'Liechtenstein'], 1],
        ['Counting its overseas territories, which country has the most time zones?', ['Russia', 'United States', 'France', 'United Kingdom'], 2],
        ['Which country is completely surrounded by South Africa?', ['Lesotho', 'Eswatini', 'Botswana', 'Malawi'], 0],
        ['The rock-hewn churches of Lalibela are in which country?', ['Egypt', 'Sudan', 'Eritrea', 'Ethiopia'], 3],
        ['Most of the Atacama Desert lies in which country?', ['Peru', 'Chile', 'Argentina', 'Bolivia'], 1],
        ['Which country has the longest coastline in the world?', ['Russia', 'Australia', 'Canada', 'Indonesia'], 2]
      ]
    ],
    uganda: [
      [
        ['What is the official currency of Uganda?', ['Kenyan shilling', 'Ugandan shilling', 'Rand', 'Naira'], 1],
        ['Which bird appears on Uganda’s flag?', ['Grey crowned crane', 'Shoebill', 'Fish eagle', 'Ostrich'], 0],
        ['Which large lake does Uganda share with Kenya and Tanzania?', ['Lake Tanganyika', 'Lake Malawi', 'Lake Victoria', 'Lake Chad'], 2],
        ['Which famous river flows out of Lake Victoria at Jinja?', ['Congo', 'Niger', 'Zambezi', 'Nile'], 3],
        ['What are the colours of Uganda’s flag?', ['Red, white and blue', 'Black, yellow and red', 'Green, yellow and black', 'Red, green and white'], 1],
        ['Which town is home to Uganda’s main international airport?', ['Entebbe', 'Mbarara', 'Gulu', 'Arua'], 0],
        ['Uganda is often called what, a nickname made famous by Winston Churchill?', ['The Pearl of Africa', 'The Rainbow Nation', 'The Land of a Thousand Hills', 'The Cradle of Mankind'], 0],
        ['What is a rolex in Ugandan street food?', ['A grilled sausage', 'A chapati rolled with eggs', 'A fried fish', 'A banana cake'], 1],
        ['In which month does Uganda celebrate Independence Day?', ['July', 'October', 'December', 'March'], 1],
        ['Which Ugandan staple is made from steamed green bananas?', ['Posho', 'Matooke', 'Chapati', 'Kalo'], 1]
      ],
      [
        ['In which year did Uganda gain independence from Britain?', ['1960', '1962', '1963', '1966'], 1],
        ['Which endangered great ape is famously tracked in Bwindi Impenetrable National Park?', ['Mountain gorilla', 'Orangutan', 'Bonobo', 'Gibbon'], 0],
        ['Which is Uganda’s largest national park?', ['Queen Elizabeth', 'Bwindi Impenetrable', 'Murchison Falls', 'Kidepo Valley'], 2],
        ['Which mountains on the Uganda–DR Congo border are called the Mountains of the Moon?', ['Rwenzori', 'Virunga', 'Elgon', 'Atlas'], 0],
        ['Which Ugandan runner won the Olympic marathon at London 2012?', ['Joshua Cheptegei', 'Stephen Kiprotich', 'Jacob Kiplimo', 'Moses Kipsiro'], 1],
        ['Which traditional kingdom is centred on Kampala?', ['Bunyoro', 'Toro', 'Buganda', 'Busoga'], 2],
        ['What title is given to the king of Buganda?', ['Kabaka', 'Omukama', 'Kyabazinga', 'Asantehene'], 0],
        ['Besides English, which language is an official language of Uganda?', ['Luganda', 'Swahili', 'Runyankole', 'Lusoga'], 1],
        ['Which Ugandan town is famous for white-water rafting on the Nile?', ['Jinja', 'Masaka', 'Lira', 'Soroti'], 0],
        ['Sipi Falls is on the slopes of which mountain?', ['Mount Rwenzori', 'Mount Elgon', 'Mount Moroto', 'Mount Kenya'], 1],
        ['At which waterfall is the Nile squeezed through a gorge only about 7 metres wide?', ['Murchison Falls', 'Sipi Falls', 'Karuma Falls', 'Itanda Falls'], 0]
      ],
      [
        ['At the Paris 2024 Olympics, Joshua Cheptegei won gold in which event?', ['Marathon', '5,000 m', '10,000 m', '3,000 m steeplechase'], 2],
        ['Who was Uganda’s Prime Minister at independence in 1962?', ['Milton Obote', 'Edward Mutesa II', 'Idi Amin', 'Benedicto Kiwanuka'], 0],
        ['Who became Uganda’s first President in 1963?', ['Milton Obote', 'Edward Mutesa II', 'Yusuf Lule', 'Godfrey Binaisa'], 1],
        ['Which Ugandan won Olympic gold in the women’s 3,000 m steeplechase at Tokyo 2020?', ['Halimah Nakaayi', 'Peruth Chemutai', 'Winnie Nanyondo', 'Stella Chesang'], 1],
        ['Which Ugandan won the 400 m hurdles at the 1972 Munich Olympics?', ['John Akii-Bua', 'Davis Kamoga', 'Stephen Kiprotich', 'Moses Kipsiro'], 0],
        ['Kidepo Valley National Park lies in which region of Uganda?', ['Karamoja', 'Kigezi', 'Buganda', 'West Nile'], 0],
        ['The Kasubi Tombs, a UNESCO World Heritage Site, are the burial grounds of which kingdom’s kings?', ['Bunyoro', 'Buganda', 'Ankole', 'Toro'], 1],
        ['What is the highest peak in Uganda?', ['Wagagai Peak', 'Margherita Peak', 'Mount Moroto', 'Mount Muhabura'], 1],
        ['On which date is Uganda Martyrs’ Day commemorated at Namugongo?', ['3 June', '9 October', '26 January', '1 May'], 0],
        ['Which of these lakes lies entirely within Uganda?', ['Lake Albert', 'Lake Edward', 'Lake Kyoga', 'Lake Victoria'], 2]
      ]
    ],
    africa: [
      [
        ['What is the largest country in Africa by area?', ['Nigeria', 'Algeria', 'DR Congo', 'Sudan'], 1],
        ['Which is the longest river in Africa?', ['Congo', 'Niger', 'Nile', 'Zambezi'], 2],
        ['What is the highest mountain in Africa?', ['Mount Kenya', 'Kilimanjaro', 'Mount Stanley', 'Mount Cameroon'], 1],
        ['Which desert covers much of North Africa?', ['Kalahari', 'Namib', 'Sahara', 'Gobi'], 2],
        ['Nelson Mandela was president of which country?', ['Zimbabwe', 'South Africa', 'Namibia', 'Botswana'], 1],
        ['Which ocean lies off Africa’s east coast?', ['Atlantic', 'Pacific', 'Arctic', 'Indian'], 3],
        ['Lagos is a major city in which country?', ['Ghana', 'Nigeria', 'Cameroon', 'Benin'], 1],
        ['Which of these is one of Africa’s Big Five animals?', ['Giraffe', 'Cheetah', 'Leopard', 'Zebra'], 2],
        ['Which African island country is famous for its lemurs?', ['Madagascar', 'Mauritius', 'Seychelles', 'Comoros'], 0],
        ['Which language is widely spoken across East Africa?', ['Swahili', 'Zulu', 'Hausa', 'Amharic'], 0]
      ],
      [
        ['How many countries are there in Africa?', ['48', '50', '54', '58'], 2],
        ['Which African country was never colonised, apart from a brief Italian occupation?', ['Ethiopia', 'Ghana', 'Kenya', 'Senegal'], 0],
        ['In which city is the African Union headquartered?', ['Nairobi', 'Addis Ababa', 'Johannesburg', 'Abuja'], 1],
        ['Which country gained independence in 1957 under Kwame Nkrumah?', ['Nigeria', 'Ghana', 'Kenya', 'Senegal'], 1],
        ['Which is the deepest lake in Africa?', ['Lake Victoria', 'Lake Malawi', 'Lake Tanganyika', 'Lake Turkana'], 2],
        ['Which country has three capital cities: Pretoria, Cape Town and Bloemfontein?', ['South Africa', 'Namibia', 'Lesotho', 'Botswana'], 0],
        ['Victoria Falls is on which river?', ['Limpopo', 'Zambezi', 'Orange', 'Congo'], 1],
        ['Which African country’s flag shows a rifle?', ['Angola', 'Mozambique', 'Zimbabwe', 'Eritrea'], 1],
        ['Which strait separates Africa from Europe at its narrowest point?', ['Bosporus', 'Strait of Gibraltar', 'Bab-el-Mandeb', 'Strait of Hormuz'], 1],
        ['Which country is the world’s largest producer of cocoa?', ['Ghana', 'Nigeria', 'Côte d’Ivoire', 'Cameroon'], 2]
      ],
      [
        ['Who was the first President of Kenya?', ['Daniel arap Moi', 'Jomo Kenyatta', 'Mwai Kibaki', 'Tom Mboya'], 1],
        ['Which African country was founded by freed American slaves and declared independence in 1847?', ['Sierra Leone', 'Liberia', 'The Gambia', 'Togo'], 1],
        ['Timbuktu, a historic centre of learning, is in which country?', ['Niger', 'Mali', 'Mauritania', 'Burkina Faso'], 1],
        ['Which is the only African country with Spanish as an official language?', ['Equatorial Guinea', 'Morocco', 'Cabo Verde', 'Guinea-Bissau'], 0],
        ['Who was the first African woman to win the Nobel Peace Prize?', ['Ellen Johnson Sirleaf', 'Wangari Maathai', 'Leymah Gbowee', 'Graça Machel'], 1],
        ['Which country has more ancient pyramids than any other?', ['Egypt', 'Sudan', 'Libya', 'Ethiopia'], 1],
        ['What is the capital of Burkina Faso?', ['Bamako', 'Niamey', 'Ouagadougou', 'Lomé'], 2],
        ['Which mountain range runs across Morocco, Algeria and Tunisia?', ['Drakensberg', 'Atlas', 'Ahaggar', 'Simien'], 1],
        ['Most of Lake Turkana, the world’s largest permanent desert lake, is in which country?', ['Ethiopia', 'Kenya', 'South Sudan', 'Uganda'], 1],
        ['Mansa Musa, famed as one of history’s richest people, ruled which empire?', ['Songhai Empire', 'Ghana Empire', 'Mali Empire', 'Kingdom of Aksum'], 2],
        ['In which year did South Africa hold its first election open to all races?', ['1990', '1992', '1994', '1996'], 2]
      ]
    ],
    sports: [
      [
        ['How many players does a basketball team have on court?', ['Five', 'Six', 'Seven', 'Eleven'], 0],
        ['In which sport do you score a try?', ['Rugby', 'Football', 'Cricket', 'Hockey'], 0],
        ['How many rings are on the Olympic flag?', ['Four', 'Five', 'Six', 'Seven'], 1],
        ['Which sport is played at Wimbledon?', ['Golf', 'Cricket', 'Tennis', 'Rugby'], 2],
        ['In most football leagues, how many points is a win worth?', ['One', 'Two', 'Three', 'Four'], 2],
        ['Which sport uses a bat, a ball and wickets?', ['Baseball', 'Cricket', 'Rounders', 'Hockey'], 1],
        ['Roughly how long is a marathon?', ['10 km', '21 km', '42 km', '50 km'], 2],
        ['Usain Bolt became famous in which sport?', ['Swimming', 'Sprinting', 'Boxing', 'Cycling'], 1],
        ['How many holes are played in a standard round of golf?', ['9', '12', '18', '21'], 2],
        ['In which sport would you see a slam dunk?', ['Volleyball', 'Basketball', 'Netball', 'Handball'], 1]
      ],
      [
        ['What colour jersey does the leader of the Tour de France wear?', ['Green', 'Yellow', 'Polka dot', 'White'], 1],
        ['Which country won the first FIFA World Cup in 1930?', ['Brazil', 'Italy', 'Uruguay', 'Argentina'], 2],
        ['How many players does a netball team have on court?', ['Five', 'Six', 'Seven', 'Nine'], 2],
        ['Which country won the 2022 FIFA World Cup?', ['France', 'Argentina', 'Brazil', 'Croatia'], 1],
        ['In tennis, what is a score of zero called?', ['Nil', 'Love', 'Duck', 'Zero'], 1],
        ['Which country has won the most Rugby World Cups?', ['New Zealand', 'South Africa', 'Australia', 'England'], 1],
        ['How long is a regular football match, not counting stoppage time?', ['80 minutes', '90 minutes', '100 minutes', '120 minutes'], 1],
        ['Which boxer called himself The Greatest?', ['Mike Tyson', 'Muhammad Ali', 'Joe Frazier', 'George Foreman'], 1],
        ['Which city hosted the 2024 Summer Olympics?', ['Tokyo', 'Los Angeles', 'Paris', 'London'], 2],
        ['In cricket, how many balls are in a standard over?', ['Four', 'Five', 'Six', 'Eight'], 2]
      ],
      [
        ['In 2022, which became the first African team to reach a World Cup semi-final?', ['Cameroon', 'Senegal', 'Ghana', 'Morocco'], 3],
        ['Which country hosted the first Africa Cup of Nations in 1957?', ['Egypt', 'Sudan', 'Ethiopia', 'Ghana'], 1],
        ['Which country has won the most Africa Cup of Nations titles?', ['Cameroon', 'Ghana', 'Egypt', 'Nigeria'], 2],
        ['In 2019, Eliud Kipchoge ran the first marathon under two hours in which city?', ['Berlin', 'London', 'Vienna', 'Monza'], 2],
        ['How many players per team are on the field in rugby union?', ['11', '13', '15', '18'], 2],
        ['In which sport is the Stanley Cup awarded?', ['Baseball', 'Ice hockey', 'American football', 'Golf'], 1],
        ['Which man has won the most Grand Slam singles titles in tennis?', ['Roger Federer', 'Rafael Nadal', 'Novak Djokovic', 'Pete Sampras'], 2],
        ['What is the standard maximum break in snooker?', ['100', '147', '155', '180'], 1],
        ['Which country has won the most FIFA World Cups?', ['Germany', 'Italy', 'Brazil', 'Argentina'], 2],
        ['In golf, what is a score of two under par on a hole called?', ['Birdie', 'Eagle', 'Albatross', 'Bogey'], 1]
      ]
    ],
    science: [
      [
        ['What do we call frozen water?', ['Steam', 'Ice', 'Dew', 'Fog'], 1],
        ['Which planet do we live on?', ['Mars', 'Venus', 'Earth', 'Saturn'], 2],
        ['What is the closest star to Earth?', ['Polaris', 'The Sun', 'Sirius', 'Alpha Centauri'], 1],
        ['How many planets are in our Solar System?', ['Seven', 'Eight', 'Nine', 'Ten'], 1],
        ['Which gas do we need to breathe in to live?', ['Oxygen', 'Nitrogen', 'Helium', 'Carbon dioxide'], 0],
        ['Which organ pumps blood around the body?', ['Lungs', 'Liver', 'Heart', 'Kidneys'], 2],
        ['At sea level, water boils at how many degrees Celsius?', ['50', '90', '100', '212'], 2],
        ['Which planet is famous for its large, bright rings?', ['Mars', 'Saturn', 'Mercury', 'Venus'], 1],
        ['What is the name of Earth’s natural satellite?', ['The Moon', 'Phobos', 'Europa', 'Titan'], 0],
        ['Which part of a plant makes food using sunlight?', ['Root', 'Stem', 'Leaf', 'Flower'], 2]
      ],
      [
        ['What is H₂O more commonly called?', ['Salt', 'Water', 'Hydrogen peroxide', 'Oxygen'], 1],
        ['Which is the largest planet in our Solar System?', ['Saturn', 'Jupiter', 'Neptune', 'Uranus'], 1],
        ['Who was the first person to walk on the Moon?', ['Buzz Aldrin', 'Yuri Gagarin', 'Neil Armstrong', 'Michael Collins'], 2],
        ['What is the centre of an atom called?', ['Electron', 'Nucleus', 'Proton', 'Shell'], 1],
        ['Roughly how long does sunlight take to reach Earth?', ['8 seconds', '8 minutes', '8 hours', '8 days'], 1],
        ['Which vitamin does your skin make in sunlight?', ['Vitamin A', 'Vitamin C', 'Vitamin D', 'Vitamin K'], 2],
        ['What is the chemical symbol for sodium?', ['So', 'Sd', 'Na', 'Sn'], 2],
        ['Which blood cells help the body fight infection?', ['Red blood cells', 'White blood cells', 'Platelets', 'Plasma'], 1],
        ['Who became the first human in space, in 1961?', ['Neil Armstrong', 'Yuri Gagarin', 'John Glenn', 'Valentina Tereshkova'], 1],
        ['Roughly how fast does sound travel through air?', ['34 m/s', '343 m/s', '3,430 m/s', '300,000 km/s'], 1]
      ],
      [
        ['What is the most abundant element in the universe?', ['Helium', 'Oxygen', 'Hydrogen', 'Carbon'], 2],
        ['Which part of a cell produces most of its energy?', ['Nucleus', 'Ribosome', 'Mitochondrion', 'Golgi body'], 2],
        ['Roughly how fast does light travel in a vacuum?', ['3,000 km/s', '30,000 km/s', '300,000 km/s', '3,000,000 km/s'], 2],
        ['Which planet has the most known moons?', ['Jupiter', 'Saturn', 'Uranus', 'Neptune'], 1],
        ['What is the boundary around a black hole, beyond which nothing can escape?', ['Photon sphere', 'Event horizon', 'Singularity', 'Accretion disc'], 1],
        ['Who developed the first successful smallpox vaccine?', ['Louis Pasteur', 'Edward Jenner', 'Alexander Fleming', 'Jonas Salk'], 1],
        ['Who discovered penicillin in 1928?', ['Alexander Fleming', 'Marie Curie', 'Louis Pasteur', 'Robert Koch'], 0],
        ['What is the pH of pure water at 25 °C?', ['0', '5', '7', '14'], 2],
        ['Who won Nobel Prizes in both physics and chemistry?', ['Marie Curie', 'Albert Einstein', 'Niels Bohr', 'Linus Pauling'], 0],
        ['Which planet spins on its side, tilted about 98 degrees?', ['Neptune', 'Uranus', 'Saturn', 'Venus'], 1]
      ]
    ],
    history: [
      [
        ['Which ancient people built the pyramids of Giza?', ['Romans', 'Greeks', 'Egyptians', 'Aztecs'], 2],
        ['Who was the first President of the United States?', ['Abraham Lincoln', 'George Washington', 'Thomas Jefferson', 'John Adams'], 1],
        ['Which ship sank in 1912 after hitting an iceberg?', ['Lusitania', 'Titanic', 'Mayflower', 'Bismarck'], 1],
        ['In which country did the ancient Olympic Games begin?', ['Italy', 'Egypt', 'Greece', 'Türkiye'], 2],
        ['Which South African leader was released from prison in 1990?', ['Desmond Tutu', 'Nelson Mandela', 'Steve Biko', 'Thabo Mbeki'], 1],
        ['What did the Wright brothers fly for the first time in 1903?', ['A car', 'An aeroplane', 'A hot-air balloon', 'A helicopter'], 1],
        ['Which wall came down in 1989, reuniting a divided city?', ['The Great Wall', 'The Berlin Wall', 'Hadrian’s Wall', 'The Western Wall'], 1],
        ['Who was the last active ruler of ancient Egypt’s Ptolemaic kingdom?', ['Nefertiti', 'Cleopatra', 'Hatshepsut', 'Nefertari'], 1],
        ['Which empire built the Colosseum?', ['Greek', 'Ottoman', 'Roman', 'Persian'], 2],
        ['Who sailed across the Atlantic to the Americas in 1492?', ['Vasco da Gama', 'Christopher Columbus', 'Ferdinand Magellan', 'James Cook'], 1]
      ],
      [
        ['In which year did World War II end?', ['1918', '1939', '1945', '1950'], 2],
        ['Who gave the famous “I Have a Dream” speech?', ['Malcolm X', 'Martin Luther King Jr.', 'Rosa Parks', 'Barack Obama'], 1],
        ['In which year did World War I begin?', ['1905', '1914', '1918', '1939'], 1],
        ['Who was the first woman to fly solo across the Atlantic?', ['Amelia Earhart', 'Bessie Coleman', 'Valentina Tereshkova', 'Harriet Quimby'], 0],
        ['Whose expedition made the first voyage around the world, finishing in 1522?', ['Christopher Columbus', 'Ferdinand Magellan', 'James Cook', 'Francis Drake'], 1],
        ['Which country gave the Statue of Liberty to the United States?', ['Britain', 'France', 'Spain', 'Italy'], 1],
        ['The Cold War was mainly a rivalry between the USA and which country?', ['China', 'The Soviet Union', 'Germany', 'Japan'], 1],
        ['Which French leader was defeated at the Battle of Waterloo?', ['Louis XIV', 'Napoleon Bonaparte', 'Charles de Gaulle', 'Joan of Arc'], 1],
        ['Which ancient wonder stood in the Egyptian city of Alexandria?', ['The Hanging Gardens', 'The Colossus', 'The Lighthouse', 'The Temple of Artemis'], 2],
        ['In which year did humans first land on the Moon?', ['1965', '1969', '1972', '1975'], 1]
      ],
      [
        ['Which treaty, signed in 1919, formally ended World War I with Germany?', ['Treaty of Paris', 'Treaty of Versailles', 'Treaty of Ghent', 'Treaty of Utrecht'], 1],
        ['The Berlin Conference of 1884–85 is known for carving up which continent?', ['Asia', 'Africa', 'South America', 'Oceania'], 1],
        ['Who unified China and became its first emperor in 221 BCE?', ['Kublai Khan', 'Qin Shi Huang', 'Sun Yat-sen', 'Confucius'], 1],
        ['In which year did the French Revolution begin?', ['1776', '1789', '1804', '1815'], 1],
        ['At the Battle of Adwa in 1896, which country defeated Italy?', ['Eritrea', 'Somalia', 'Ethiopia', 'Libya'], 2],
        ['Which Roman city was buried when Mount Vesuvius erupted in 79 CE?', ['Athens', 'Carthage', 'Pompeii', 'Troy'], 2],
        ['Who became the world’s first female prime minister, in 1960?', ['Indira Gandhi', 'Golda Meir', 'Sirimavo Bandaranaike', 'Margaret Thatcher'], 2],
        ['Which empire was ruled from Constantinople until 1453?', ['Ottoman', 'Byzantine', 'Persian', 'Holy Roman'], 1],
        ['The Rosetta Stone helped scholars decode which writing system?', ['Cuneiform', 'Egyptian hieroglyphs', 'Linear B', 'Maya glyphs'], 1],
        ['Which uprising against British rule in Kenya began in 1952?', ['Maji Maji', 'Mau Mau', 'Chimurenga', 'Anglo-Zulu War'], 1]
      ]
    ]
  };

  function fromTopics(topics, makePrompt = text => ({ text })) {
    return Object.entries(topics).flatMap(([category, tiers]) => tiers.flatMap((items, i) =>
      items.map(item => ({ ...makePrompt(item), category, difficulty: LEVELS[i] }))));
  }

  const hardTaboo = [
    ['Gravity', ['Fall', 'Earth', 'Force', 'Pull', 'Space']],
    ['Patience', ['Wait', 'Calm', 'Time', 'Angry', 'Tolerate']],
    ['Nostalgia', ['Past', 'Memory', 'Childhood', 'Old', 'Remember']],
    ['Democracy', ['Vote', 'Government', 'People', 'Election', 'Leader']],
    ['Camouflage', ['Hide', 'Blend', 'Colour', 'Animal', 'Army']],
    ['Paradox', ['Contradiction', 'Impossible', 'Logic', 'True', 'False']],
    ['Photosynthesis', ['Plant', 'Sunlight', 'Energy', 'Leaf', 'Oxygen']],
    ['Symmetry', ['Mirror', 'Same', 'Half', 'Balance', 'Pattern']],
    ['Procrastination', ['Delay', 'Later', 'Task', 'Avoid', 'Tomorrow']],
    ['Metaphor', ['Compare', 'Like', 'Figure', 'Speech', 'Meaning']],
    ['Inflation', ['Prices', 'Money', 'Rise', 'Cost', 'Economy']],
    ['Coincidence', ['Chance', 'Accident', 'Same', 'Unexpected', 'Happen']]
  ];
  const mediumTaboo = new Set(['Library', 'Doctor', 'Aeroplane', 'Camera', 'Wedding', 'Mountain', 'Computer', 'Firefighter', 'Telescope', 'Suitcase', 'Bridge', 'Robot', 'Backpack', 'Chess', 'Swimming pool', 'Clock', 'Candle', 'Dance']);

  const imposterTopics = {
    animals: [['Lion', 'Elephant', 'Penguin', 'Dolphin', 'Butterfly', 'Crocodile', 'Giraffe', 'Rabbit', 'Owl', 'Octopus', 'Kangaroo', 'Bee']],
    food: [['Pizza', 'Popcorn', 'Chocolate', 'Banana', 'Pancakes', 'Pineapple', 'Spaghetti', 'Ice cream', 'Watermelon', 'Burger', 'Rice', 'Avocado']],
    places: [['Beach', 'Library', 'Airport', 'School', 'Hospital', 'Market', 'Cinema', 'Zoo', 'Museum', 'Stadium', 'Hotel', 'Farm']],
    objects: [['Umbrella', 'Guitar', 'Bicycle', 'Camera', 'Telescope', 'Suitcase', 'Toothbrush', 'Clock', 'Candle', 'Headphones', 'Backpack', 'Kite']]
  };

  // [emoji puzzle, answer] from easy to hard.
  const emojiTopics = {
    films: [
      [['🦁👑', 'The Lion King'], ['❄️👸', 'Frozen'], ['🕷️🧑', 'Spider-Man'], ['🧸🤠🚀', 'Toy Story'], ['🦈🌊😱', 'Jaws'], ['🐠🔍', 'Finding Nemo']],
      [['🚢🧊💔', 'Titanic'], ['🦖🏝️', 'Jurassic Park'], ['👻👨‍🔬📞', 'Ghostbusters'], ['⭐⚔️🌌', 'Star Wars'], ['🧙‍♂️💍🌋', 'The Lord of the Rings'], ['🐼🥋', 'Kung Fu Panda']],
      [['🕰️🔙🚗', 'Back to the Future'], ['🌽🧑‍🚀🕳️', 'Interstellar'], ['💊🕶️🤖', 'The Matrix'], ['🦇🃏', 'The Dark Knight'], ['🏃‍♂️🍫📦', 'Forrest Gump'], ['👽📞🏠', 'E.T.']]
    ],
    phrases: [
      [['🌧️🐱🐶', 'Raining cats and dogs'], ['⏰💰', 'Time is money'], ['🍎📅🩺', 'An apple a day keeps the doctor away'], ['🐦🐦🪨', 'Kill two birds with one stone'], ['🧊🔨', 'Break the ice'], ['🍰👌', 'Piece of cake']],
      [['🐘🏠', 'The elephant in the room'], ['🐈👜', 'Let the cat out of the bag'], ['🍳➡️🔥', 'Out of the frying pan, into the fire'], ['🍋➡️🥤', 'When life gives you lemons, make lemonade'], ['🛒🐎', 'Putting the cart before the horse'], ['💙🌕', 'Once in a blue moon']],
      [['🐂🏪🍽️', 'A bull in a china shop'], ['🦶👄', 'Put your foot in your mouth'], ['🐺👕🐑', 'A wolf in sheep’s clothing'], ['🥚🥚🧺', 'Don’t put all your eggs in one basket'], ['🐟🏜️', 'A fish out of water'], ['✋🍪🫙', 'Caught with your hand in the cookie jar']]
    ],
    places: [
      [['🗼🥐', 'Paris'], ['🗽🍎', 'New York'], ['🦘🪃', 'Australia'], ['🐪🔺', 'Egypt'], ['🍣🗻', 'Japan'], ['🐼🧱🏯', 'China']],
      [['🦍🍌🌊', 'Uganda'], ['🎡🫖💂', 'London'], ['🌷🚲🧀', 'The Netherlands'], ['🍁🏒', 'Canada'], ['🌮🌵🪅', 'Mexico'], ['🏙️🏜️🛍️', 'Dubai']],
      [['🐧🧊🌍', 'Antarctica'], ['🌉🌁🚋', 'San Francisco'], ['🗿🏝️', 'Easter Island'], ['🧀🏔️⌚', 'Switzerland'], ['🏔️🦓🌍', 'Tanzania'], ['🏰🍺🥨', 'Germany']]
    ]
  };

  const likelyPrompts = [
    'Become famous by accident', 'Survive a zombie apocalypse', 'Forget their own birthday', 'Get lost in their own neighbourhood',
    'Win a dance-off', 'Eat the last slice without asking', 'Cry at a cartoon', 'Talk their way out of anything',
    'Start a business from their bedroom', 'Fall asleep at a party', 'Laugh at the worst possible moment', 'Adopt ten cats',
    'Become president one day', 'Reply to a message three days late', 'Show up two hours late, smiling', 'Win a reality TV show',
    'Accidentally go viral', 'Know all the latest gossip', 'Bring snacks to every hangout', 'Get stopped by airport security',
    'Sing loudly in the shower', 'Lose their phone while holding it', 'Plan the perfect surprise party', 'Become a millionaire',
    'Argue with a referee', 'Take 100 selfies for one photo', 'Befriend a total stranger in a queue', 'Fix anything with tape',
    'Try every street food in town', 'Give the best advice', 'Spend all their money on shoes', 'Start a dance at a wedding'
  ];

  const GAMES = [
    {
      id: 'charades', title: 'Charades', tagline: 'Big gestures. Zero words.',
      description: 'Act it out while your team connects the dots. No words, just wildly good guesses.',
      category: 'team', minPlayers: 4, duration: '60 sec', badge: 'A crowd favourite',
      icon: 'charades', color: 'peach',
      rules: ['Choose one actor from the playing team. Only the actor should see the prompt.', 'Act without speaking, spelling, or pointing to objects in the room.', 'Your team has 60 seconds to guess as many prompts as possible. Award 1 point per correct guess.', 'Skip a tricky prompt if you need to. Rotate actors and teams each round.'],
      supportsDifficulty: true,
      prompts: fromTopics(charadesTopics)
    },
    {
      id: 'taboo', title: 'Taboo', tagline: 'Say it. Without saying it.',
      description: 'Get your team to guess the word without letting the forbidden words slip out.',
      category: 'team', minPlayers: 4, duration: '60 sec', badge: 'Watch your words',
      icon: 'taboo', color: 'lime',
      rules: ['Choose one clue-giver. Only the clue-giver and a referee from another team should see the card.', 'Describe the main word without saying it, any part of it, or any forbidden word.', 'If a forbidden word slips out, skip that card. No gestures or spelling clues.', 'Score 1 point for each correctly guessed word in 60 seconds, then switch teams.'],
      supportsDifficulty: true,
      prompts: [
        ...tabooPrompts.map(([text, forbidden]) => ({ text, forbidden, category: 'mixed', difficulty: mediumTaboo.has(text) ? 'medium' : 'easy' })),
        ...hardTaboo.map(([text, forbidden]) => ({ text, forbidden, category: 'mixed', difficulty: 'hard' }))
      ]
    },
    {
      id: 'trivia', title: 'Trivia', tagline: 'A little knowledge. A lot of glory.',
      description: 'A game-show night: every team takes the hot seat for ten questions a level, from Easy to Hard.',
      category: 'team', minPlayers: 2, duration: '10 Qs a level', badge: 'Brainpower, together',
      icon: 'trivia', color: 'lavender',
      rules: ['Each team plays its own round of 10 questions per level, one team after another.', 'One player sits in the hot seat and answers before the clock runs out.', 'Easy answers are worth 1 point, Medium 2, and Hard 3.', 'After question 5 there is a 2-minute halftime huddle to swap who’s up. When it ends, that player finishes the round.'],
      supportsDifficulty: true,
      prompts: [
        ...triviaPrompts.map(([text, options, answer, category, level]) => ({ text, options, answer, category, difficulty: LEVELS[level] })),
        ...fromTopics(extraTrivia, ([text, options, answer]) => ({ text, options, answer })),
        ...fromTopics(moreTrivia, ([text, options, answer]) => ({ text, options, answer }))
      ]
    },
    {
      id: 'quickdraw', title: 'Quick Draw', tagline: 'Bad drawings. Great guesses.',
      description: 'Grab a pen, beat the clock, and turn your questionable art into winning guesses.',
      category: 'team', minPlayers: 4, duration: '60 sec', badge: 'Bring pen & paper',
      icon: 'quickdraw', color: 'blue',
      rules: ['Grab paper and a pen. Choose one artist from the playing team.', 'Only the artist should see the prompt. Draw it without letters, numbers, or speaking.', 'Your team has 60 seconds to guess. Score 1 point per correct drawing.', 'Use fresh paper for the next prompt, and rotate artists and teams each round.'],
      supportsDifficulty: true,
      prompts: fromTopics(drawingTopics)
    },
    {
      id: 'five-second', title: 'Five-Second Challenge', tagline: 'Name three. Go!',
      description: 'Name three things that fit before the buzzer. Easy to start, sneakily hard by the end.',
      category: 'team', minPlayers: 2, duration: '5 sec', badge: 'Fast & frantic',
      icon: 'five-second', color: 'mint',
      rules: ['Choose one player from the playing team to answer. Read their prompt aloud.', 'Tap Start. They have five seconds to name three different answers out loud.', 'Everyone else is the referee: three fair answers in time earns 1 point.', 'Keep going prompt after prompt, then pass the turn to the next team.'],
      supportsDifficulty: true,
      prompts: fromTopics(fastTopics, text => ({ text: `Name three ${text}` }))
    },
    {
      id: 'who-am-i', title: 'Who Am I?', tagline: 'Hold it up. Guess who.',
      description: 'Hold the screen to your forehead while your team describes who, or what, you are.',
      category: 'team', minPlayers: 4, duration: '60 sec', badge: 'Screen to forehead',
      icon: 'who-am-i', color: 'sand',
      rules: ['Choose one guesser. They hold the screen facing their team, so they cannot see it.', 'Teammates describe the name on screen without saying it, any part of it, or spelling it.', 'Your team has 60 seconds. Tap Got it for each correct guess, or skip if you are stuck.', 'Rotate guessers and teams each round.'],
      supportsDifficulty: true,
      prompts: fromTopics(identityTopics)
    },
    {
      id: 'emoji-decode', title: 'Emoji Decode', tagline: 'Read the emojis. Shout the answer.',
      description: 'A string of emojis hides a film, a saying, or a place. Crack as many as you can before the buzzer.',
      category: 'team', minPlayers: 2, duration: '60 sec', badge: 'Emoji brain',
      icon: 'emoji-decode', color: 'peach',
      rules: ['One player holds the screen so their team can see the emojis.', 'The team shouts guesses. Only the holder peeks at the answer.', 'Tap Got it for each correct guess, or skip a tough one.', 'Each team gets one turn per level. Easy, then Medium, then Hard.'],
      supportsDifficulty: true,
      prompts: fromTopics(emojiTopics, ([text, answer]) => ({ text, answer }))
    },
    {
      id: 'imposter', title: 'Guess the Imposter', tagline: 'One of you is bluffing.',
      description: 'Everyone sees the secret word except one person. Give clues, spot the bluffer, and vote.',
      category: 'social', minPlayers: 3, maxPlayers: 12, duration: '3 min', badge: 'Secret roles',
      icon: 'imposter', color: 'slate', phoneMode: true,
      rules: ['Pass the device around. Each player privately sees the secret word, except the imposter.', 'Take turns giving one short clue about the word. The imposter has to bluff.', 'Discuss, then everyone casts a private vote for who they think the imposter is.', 'If the imposter is caught, they get one last guess at the word. Guess right and they steal the win.'],
      prompts: fromTopics(imposterTopics)
    },
    {
      id: 'categories', title: 'Categories', tagline: 'Think quick. Keep it going.',
      description: 'One category, a circle of friends, and absolutely no repeat answers.',
      category: 'icebreaker', minPlayers: 2, duration: '60 sec', badge: 'Quick on your feet',
      icon: 'categories', color: 'yellow',
      rules: ['Read the category aloud and sit or stand in a circle.', 'Go around the circle, naming one thing that fits. No repeated answers.', 'Allow about 5 seconds per player. If someone gets stuck or repeats an answer, they sit out for this round.', 'Stop after 60 seconds or when one player remains. Celebrate the survivors and start a new category.'],
      prompts: categoryPrompts.map(text => ({ text }))
    },
    {
      id: 'would-you-rather', title: 'Would You Rather', tagline: 'Pick a side. Defend it.',
      description: 'Impossible choices, surprising answers, and the debates you never saw coming.',
      category: 'icebreaker', minPlayers: 2, duration: 'No timer', badge: 'Get everyone talking',
      icon: 'would-you-rather', color: 'pink', phoneMode: true,
      rules: ['Read both choices aloud so everyone can hear them.', 'Everyone picks A or B. No choosing both!', 'Take turns explaining your choice. Ask a friend why they picked the other side.', 'There are no points or wrong answers. Move to the next card when everyone has had a turn.'],
      prompts: choicePrompts.map(([optionA, optionB]) => ({ text: 'Would you rather…', optionA, optionB }))
    },
    {
      id: 'most-likely', title: 'Most Likely To', tagline: 'Point first. Explain later.',
      description: 'Who’s most likely to survive a zombie apocalypse? Everyone points on three, and the winner earns a title.',
      category: 'icebreaker', minPlayers: 3, duration: '10 rounds', badge: 'Uses your names',
      icon: 'most-likely', color: 'pink', phoneMode: true,
      rules: ['Read the prompt aloud.', 'On three, everyone points at the person who fits it best.', 'Tap whoever got the most fingers. They earn that title!', 'After ten prompts, see who collected the most titles.'],
      prompts: likelyPrompts.map(text => ({ text }))
    },
    {
      id: 'pass-bomb', title: 'Pass the Bomb', tagline: 'Answer fast. Pass faster.',
      description: 'A hidden fuse is burning. Name something that fits, pass the screen, and pray it doesn’t blow up in your hands.',
      category: 'icebreaker', minPlayers: 3, duration: '5 rounds', badge: 'Hidden timer',
      icon: 'pass-bomb', color: 'sand', phoneMode: true,
      rules: ['Sit in a circle and light the fuse. Nobody knows how long it lasts.', 'Name one thing that fits the category, then tap Pass and hand the screen on.', 'The ticking speeds up. Whoever holds it when it explodes takes a bomb.', 'After five rounds, the player with the fewest bombs wins.'],
      prompts: categoryPrompts.map(text => ({ text }))
    },
    {
      id: 'matatu', title: 'Matatu', tagline: 'Follow suit. Drop a 2. Cut the game.',
      description: 'Uganda’s favourite card game, played on your phones. Scan the code, get your seven cards, and outplay the table.',
      category: 'phones', minPlayers: 2, maxPlayers: 6, duration: '15 min', badge: 'Scan & play',
      icon: 'matatu', color: 'mint', phone: true,
      rules: ['Everyone scans the code. Seven cards appear on each phone. A cutting card is turned face up: the 7 of its suit is the cutter.', 'Follow the top card’s suit or rank. Can’t play, or don’t want to? Tap Pick to take one card. Your turn ends.', 'Power cards: a 2 makes the next player pick 2 unless they answer with a 2 (then the next picks 4). An 8 or a Jack skips the next player. An Ace goes on anything and you choose the suit.', 'Play all your cards to win, or play the cutter to end the game: everyone counts the points in their hand and the lowest total wins. A = 15, 2 = 20, J = 11, Q = 12, K = 13, other cards face value.'],
      prompts: []
    },
    {
      id: 'rps', title: 'Rock Paper Scissors', tagline: 'Two phones. One champion.',
      description: 'A best-of-five duel. Both players throw in secret on their phones, and the big screen reveals the result.',
      category: 'phones', minPlayers: 2, maxPlayers: 2, duration: '2 min', badge: 'Duel',
      icon: 'rps', color: 'blue', phone: true,
      rules: ['Two players scan the code to join.', 'Each round, both pick rock, paper, or scissors in secret on their phone.', 'Rock beats scissors, scissors beat paper, and paper beats rock.', 'First to three wins takes the crown. Rematch as often as you like.'],
      prompts: []
    },
    {
      id: 'four-row', title: 'Four in a Row', tagline: 'Drop it. Block it. Connect it.',
      description: 'Take turns dropping discs from your phones. The first to line up four in a row wins.',
      category: 'phones', minPlayers: 2, maxPlayers: 2, duration: '10 min', badge: 'Duel',
      icon: 'four-row', color: 'lavender', phone: true,
      rules: ['Two players scan the code to join.', 'Take turns tapping a column on your phone to drop a disc.', 'Line up four across, down, or diagonally to win.', 'Block your rival before they connect!'],
      prompts: []
    }
  ];

  function deepFreeze(value) {
    Object.freeze(value);
    Object.values(value).forEach(child => {
      if (child && typeof child === 'object' && !Object.isFrozen(child)) deepFreeze(child);
    });
    return value;
  }

  // The original array is never modified. Supplying an RNG makes tests reproducible.
  function shuffle(items, rng = Math.random) {
    if (!Array.isArray(items)) throw new TypeError('Expected an array to shuffle.');
    if (typeof rng !== 'function') throw new TypeError('The random source must be a function.');
    const result = items.slice();
    for (let i = result.length - 1; i > 0; i -= 1) {
      const random = rng();
      if (!Number.isFinite(random) || random < 0 || random >= 1) {
        throw new RangeError('The random source must return a number from 0 up to, but not including, 1.');
      }
      const j = Math.floor(random * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  function createTeams(players, teamCount, rng = Math.random) {
    if (!Array.isArray(players) || players.length < 2 || players.length > 40) {
      throw new RangeError('Choose between 2 and 40 players.');
    }
    if (!Number.isInteger(teamCount) || teamCount < 2 || teamCount > 8 || teamCount > players.length) {
      throw new RangeError('Choose 2 to 8 teams, with at least one player on each team.');
    }
    const seen = new Set();
    const cleanedPlayers = players.map((player, index) => {
      if (!player || (typeof player.id !== 'string' && typeof player.id !== 'number') || String(player.id).trim() === '' || (typeof player.id === 'number' && !Number.isFinite(player.id))) {
        throw new TypeError('Every player needs a unique ID.');
      }
      const key = String(player.id);
      if (seen.has(key)) throw new TypeError('Every player needs a unique ID.');
      seen.add(key);
      if (player.name !== undefined && typeof player.name !== 'string') throw new TypeError('Player names must be text.');
      return { id: player.id, name: (player.name || '').trim() || `Player ${index + 1}` };
    });
    const teams = TEAM_PALETTE.slice(0, teamCount).map((palette, index) => ({
      id: `team-${index + 1}`, name: palette.name, color: palette.color, players: [], score: 0
    }));
    shuffle(cleanedPlayers, rng).forEach((player, index) => teams[index % teamCount].players.push(player));
    return teams;
  }

  function getGame(id) {
    return GAMES.find(game => game.id === id);
  }

  function categoryLabel(id) {
    return labels[id] || String(id || '');
  }

  function getCategories(gameId) {
    const game = getGame(gameId);
    if (!game) return [];
    const counts = new Map();
    game.prompts.forEach(prompt => { if (prompt.category) counts.set(prompt.category, (counts.get(prompt.category) || 0) + 1); });
    return [...counts].map(([id, count]) => ({ id, label: categoryLabel(id), count }));
  }

  // A fixed mode always wins. Auto mode climbs one level after every PROMPTS_PER_LEVEL prompts played.
  function getDifficulty(played, mode = 'auto') {
    if (LEVELS.includes(mode)) return mode;
    const count = Number.isSafeInteger(played) && played > 0 ? played : 0;
    return LEVELS[Math.min(LEVELS.length - 1, Math.floor(count / PROMPTS_PER_LEVEL))];
  }

  // Filters narrow the deck, but never empty it: an unmatched level or category falls back to a wider pool.
  function createDeck(gameId, rng = Math.random, filters = {}) {
    const game = getGame(gameId);
    if (!game) throw new RangeError(`Unknown game: ${gameId}`);
    let pool = game.prompts;
    if (filters.category && filters.category !== 'all') {
      const matching = pool.filter(prompt => prompt.category === filters.category);
      if (matching.length) pool = matching;
    }
    if (filters.difficulty) {
      const matching = pool.filter(prompt => prompt.difficulty === filters.difficulty);
      if (matching.length) pool = matching;
    }
    const prompts = pool.map(prompt => {
      const copy = { ...prompt };
      if (prompt.options) copy.options = prompt.options.slice();
      if (prompt.forbidden) copy.forbidden = prompt.forbidden.slice();
      return copy;
    });
    return shuffle(prompts, rng);
  }

  deepFreeze(GAMES);
  deepFreeze(TEAM_PALETTE);
  return Object.freeze({ GAMES, TEAM_PALETTE, LEVELS: Object.freeze(LEVELS.slice()), PROMPTS_PER_LEVEL, shuffle, createTeams, createDeck, getGame, getCategories, getDifficulty, categoryLabel });
});
