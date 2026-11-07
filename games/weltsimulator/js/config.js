/* ================= CONFIG =================
   Feste Eckdaten der Welt und Namenslisten (zürich-artig). Die Welt ist bei jedem Start gleich,
   weil alles aus demselben Startwert erzeugt wird. */

const WS = {
  SEED: 20261107,
  HALF: 2500,              // Welt: -2500..2500 m in x und z (5 x 5 km)
  CITY_Y: 2.5,             // Höhe der Stadtebene
  WATER_Y: 0.3,            // Wasserspiegel (Meer, Fluss, Kanäle)
  VENICE_Y: 1.9,
  CHUNK: 1250,
  HILL: { x: -620, z: -980, h: 72, plateau: 95, sigma: 230 },   // ETH-Hügel
  CENTER: { x: 250, z: -330 },                                   // Stadtzentrum
  VENICE: { x0: 1470, x1: 2200, z0: -1180, z1: -400 },
  TRAM_V: { x: 1385, z: -790 },                                  // Tram-Endschlaufe Hafen
  PIAZZA: { x: 1955, z: -660, hw: 52, hd: 70 },
  GRID: 135,
  DAY_MINUTES: 24,         // ein ganzer Tag dauert 24 echte Minuten
  CITY_NAME: 'Neu-Zürich'
};

const INNER_HILLS = [
  { x: -1500, z: 950, h: 30, s: 170 },
  { x: 1050, z: 1420, h: 24, s: 150 },
  { x: -1250, z: -1550, h: 34, s: 190 },
  { x: 650, z: -1500, h: 18, s: 140 },
  { x: -300, z: 1550, h: 22, s: 160 }
];

const STREETS_H = ['Bahnhofstrasse', 'Seefeldstrasse', 'Badenerstrasse', 'Rämistrasse', 'Universitätstrasse', 'Langstrasse',
  'Hardstrasse', 'Weinbergstrasse', 'Stampfenbachstrasse', 'Löwenstrasse', 'Talstrasse', 'Bleicherweg', 'Mythenquai',
  'Forchstrasse', 'Dufourstrasse', 'Klosbachstrasse', 'Zeltweg', 'Hottingerstrasse', 'Winterthurerstrasse',
  'Schaffhauserstrasse', 'Hofwiesenstrasse', 'Birmensdorferstrasse', 'Kalkbreitestrasse', 'Josefstrasse',
  'Limmatstrasse', 'Neugasse', 'Konradstrasse', 'Zollstrasse', 'Röntgenstrasse', 'Heinrichstrasse'];
const STREETS_V = ['Asylstrasse', 'Freiestrasse', 'Sonneggstrasse', 'Culmannstrasse', 'Gloriastrasse', 'Tannenstrasse',
  'Clausiusstrasse', 'Leonhardstrasse', 'Militärstrasse', 'Kanonengasse', 'Feldstrasse', 'Brauerstrasse',
  'Zypressenstrasse', 'Albisriederstrasse', 'Bertastrasse', 'Idastrasse', 'Zurlindenstrasse', 'Gutstrasse',
  'Uetlibergstrasse', 'Manessestrasse', 'Sihlhallenstrasse', 'Ausstellungsstrasse', 'Quellenstrasse',
  'Fabrikstrasse', 'Wasserwerkstrasse', 'Nordstrasse', 'Rousseaustrasse', 'Lettenstrasse', 'Breitensteinstrasse', 'Kornhausstrasse'];
const ALLEYS = ['Spiegelgasse', 'Napfgasse', 'Kirchgasse', 'Trittligasse', 'Rindermarkt', 'Glockengasse', 'Strehlgasse',
  'Thermengasse', 'Schipfe', 'Oetenbachgasse', 'Augustinergasse', 'Storchengasse', 'Münstergasse', 'Froschaugasse',
  'Brunngasse', 'Predigergasse', 'Zähringergasse', 'Mühlegasse', 'Niederdorfgasse', 'Laternengasse', 'Hirschengasse',
  'Wühregasse', 'Pfalzgasse', 'Kuttelgasse', 'Waaggasse', 'Schoffelgasse', 'Römergasse', 'Leuengasse'];

const METRO_STATIONS = ['Altstetten', 'Lindenplatz', 'Albisriederplatz', 'Stauffacher', 'Paradeplatz', 'Bellevue',
  'Stadelhofen', 'Seefeld', 'Tiefenbrunnen', 'Oerlikon', 'Milchbuck', 'Universität', 'Central', 'Hauptbahnhof',
  'Enge', 'Wollishofen', 'Wiedikon', 'Friesenberg', 'Triemli', 'Höngg', 'Wipkingen', 'Escher-Wyss-Platz',
  'Hardbrücke', 'Letten', 'Kreuzplatz', 'Hegibach', 'Balgrist', 'Hirslanden', 'Witikon', 'Schwamendingen',
  'Seebach', 'Affoltern', 'Leimbach', 'Brunau', 'Sihlquai', 'Rosengarten', 'Bucheggplatz', 'Irchel', 'Fluntern', 'Riviera'];

const TRAM_STATIONS = ['Venezia Hafen', 'Arsenale', 'Limmatquai', 'Rathaus', 'Zentrum', 'Kunsthaus', 'Neumarkt',
  'Platte', 'Haldenegg', 'Hochschulen', 'Polyterrasse', 'Waldhaus', 'ETH Zentrum'];

const BUS_STOPS = ['Hegibachplatz', 'Römerhof', 'Klusplatz', 'Toblerplatz', 'Rigiplatz', 'Schaffhauserplatz',
  'Kunsthalle', 'Rentenanstalt', 'Saalsporthalle', 'Sihlcity', 'Giesshübel', 'Laubegg', 'Uetlihof', 'Heuried',
  'Talwiesen', 'Goldbrunnenplatz', 'Lochergut', 'Bezirksgebäude', 'Kalkbreite', 'Helvetiaplatz', 'Bäckeranlage',
  'Limmatplatz', 'Hardturm', 'Sportweg', 'Grünau', 'Tüffenwies', 'Werdhölzli', 'Meierhofplatz', 'Wartau',
  'Frankental', 'Lehenstrasse', 'Waidspital', 'Guggach', 'Radiostudio', 'Laubiweg', 'Hirschwiesen', 'Sternen',
  'Regensbergbrücke', 'Glaubten', 'Hagenholz', 'Auzelg', 'Hirzenbach', 'Luchswiesen', 'Mattenhof', 'Stettbach',
  'Dolder', 'Susenberg', 'Rehalp', 'Burgwies', 'Wildbach', 'Feldeggstrasse', 'Fröhlichstrasse', 'Höschgasse',
  'Wildbachstrasse', 'Mühlebach', 'Rüdenplatz', 'Morgental', 'Butzen', 'Thujastrasse', 'Albisstrasse', 'Post Wollishofen',
  'Bachtobel', 'Schmiede Wiedikon', 'Zweierplatz', 'Bahnhof Selnau', 'Sihlpost', 'Kasernenplatz', 'Stockerstrasse',
  'Tunnelstrasse', 'Brunaupark', 'Seilbahn Rigiblick', 'Kantonsschule', 'Hochstrasse', 'Bergstrasse', 'Kirche Fluntern',
  'Zoo', 'Allmend', 'Utohof', 'Lindenbach', 'Seerose', 'Strandbad', 'Riviera Lido', 'Promenade Nord', 'Promenade Süd',
  'Leuchtturm', 'Kongresshaus', 'Casino', 'Hafenkran', 'Fischmarkt', 'Möwenplatz', 'Sonnenquai', 'Palmenhain',
  'Markthalle', 'Stadion', 'Messe', 'Theater', 'Oper', 'Bibliothek', 'Spital', 'Feuerwehr', 'Schulhaus', 'Friedhof', 'Badeanstalt'];

const HOTEL_NAMES = ['Grand Hotel Seeblick', 'Riviera Palace', 'Hotel Mirabeau', 'Royal Lido', 'Hotel Aurora',
  'Excelsior Mare', 'Palazzo Azzurro', 'Hotel Belvedere', 'Majestic Beach', 'Hotel Bellavista', 'Grand Hôtel du Lac',
  'Hotel Imperial', 'Sea Crown Resort', 'Hotel Splendid', 'Hotel Atlantis', 'Coral Bay Hotel', 'Hotel Sirena',
  'Golden Sands', 'Hotel Ambassador', 'Hotel Continental', 'Marina Grand', 'Hotel Esplanade', 'Sunset Towers',
  'Hotel Panorama', 'Ocean Pearl', 'Hotel Sonnenhof', 'Hotel Bristol', 'Hotel Metropol', 'Hotel Savoy Mare', 'Hotel Astoria'];

const FIRM_NAMES = ['Novatek', 'Alpina Systems', 'Helvetix', 'Quantis Labs', 'Bergwerk Digital', 'Limmat Robotics',
  'Gletscher AG', 'Edelweiss Data', 'Matterhorn Capital', 'Seestern Pharma', 'Föhn Energie', 'Rigi Software',
  'Zürcher Bauwerk', 'Lindt & Partner', 'Polymat AG', 'Silberfluss Bank', 'Kristall Optik', 'Tellur Medical',
  'Säntis Logistik', 'Uto Mobility', 'Aareon Labs', 'Helios Solar', 'Cumulus Cloud', 'Sihltal Media'];

const QUARTERS = [
  { name: 'Klein-Venedig', test: (x, z) => x > 1450 && z > -1200 && z < -380 },
  { name: 'Riviera', test: (x, z) => x > coastX(z) - 260 },
  { name: 'Hochschulhügel', test: (x, z) => Math.hypot(x - WS.HILL.x, z - WS.HILL.z) < 480 },
  { name: 'Zentrum', test: (x, z) => Math.hypot(x - WS.CENTER.x, z - WS.CENTER.z) < 520 },
  { name: 'Limmatufer', test: (x, z) => waterDist(x, z) < 90 },
  { name: 'Berge', test: (x, z) => terrainH(x, z) > 30 },
  { name: 'Oberstrass', test: (x, z) => z < -500 && x < 300 },
  { name: 'Hottingen', test: (x, z) => z < -500 },
  { name: 'Aussersihl', test: (x, z) => z < 300 && x < 0 },
  { name: 'Seefeld', test: (x, z) => z < 300 },
  { name: 'Wiedikon', test: (x, z) => x < 0 },
  { name: 'Wollishofen', test: () => true }
];
function quarterAt(x, z) { for (const q of QUARTERS) if (q.test(x, z)) return q.name; return ''; }
