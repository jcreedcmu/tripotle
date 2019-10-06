const fs = require('fs');
const qs = require('querystring');

const CACHE = '/tmp/tripotle.json';
const API_KEY = fs.readFileSync('/home/jcreed/private/maps-api2', 'utf8').replace(/\n/g, '');

function getContent(url) {
  return new Promise((res, rej) => {
    const lib = url.startsWith('https') ? require('https') : require('http');
    const request = lib.get(url, (response) => {
      if (response.statusCode < 200 || response.statusCode > 299) {
         rej(new Error('Failed to load page, status code: ' + response.statusCode));
       }
      let body = '';
      response.on('data', chunk => body += chunk);
      response.on('end', () => res(body));
    });
    request.on('error', err => rej(err))
  });
}

async function pause(millis) {
  return new Promise((res, rej) => {
	 setTimeout(() => res(), millis);
  });
}

function stringOfPos(pos) {
  return `${pos.lat},${pos.lng}`;
}

const top = {lat: 40.798892, lng: -73.954127}; // top of central park
const bot = {lat: 40.701679, lng: -74.012682}; // bottom of manhattan
const middle = {lat: 40.7831, lng: -73.9712}; // columbus circleish

function lerp(pos1, pos2, alpha) {
  return {lat: pos1.lat * (1-alpha) + pos2.lat * alpha,
			 lng: pos1.lng * (1-alpha) + pos2.lng * alpha};
}

function queryFor(pos) {
  return qs.encode({
	 key: API_KEY,
	 query: "chipotle",
	 inputtype: "textquery",
	 location: stringOfPos(pos),
	 radius: 4000, // m
  });
}

const N = 10;

async function getData() {
  const results = [];
  for (i = 0; i <= N; i++) {
	 const pos = lerp(top, bot, i / N);
	 const query = await queryFor(pos);
	 const url = "https://maps.googleapis.com/maps/api/place/textsearch/json?" + query;
	 console.error(url);
	 results.push(JSON.parse(await getContent(url)));
	 await pause(1000);
  }
  fs.writeFileSync(CACHE, JSON.stringify(results, null, 2), 'utf8');
}

async function go() {
  if (!fs.existsSync(CACHE)) {
	 await getData();
  }
  const data = JSON.parse(fs.readFileSync(CACHE, 'utf8'));
  const chipotles = {};
  for (const q of data) {
	 for (const res of q.results) {
		if (!res.formatted_address.match(/New York/)) continue;
		const loc = stringOfPos(res.geometry.location);
		chipotles[loc] = res;
	 }
  }
  console.log(Object.keys(chipotles));
}

go().then(x => console.log(x)).catch(x => console.error(x));
