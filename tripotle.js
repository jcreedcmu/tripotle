const fs = require('fs');
const qs = require('querystring');

const CACHE = '/tmp/tripotle.json';
const API_KEY = fs.readFileSync('/home/jcreed/private/maps-api2', 'utf8').replace(/\n/g, '');


function sqr(x) { return x * x }

function sdist(a, b) {
  return sqr(a.x - b.x) + sqr(a.y - b.y);
}

function circumcenter(a, b, c) {
  const D = 2 * (a.x * ( b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  return {
	 x: (1/D) * ((sqr(a.x) + sqr(a.y)) * (b.y - c.y) +
					 (sqr(b.x) + sqr(b.y)) * (c.y - a.y) +
					 (sqr(c.x) + sqr(c.y)) * (a.y - b.y)),
	 y: (1/D) * ((sqr(a.x) + sqr(a.y)) * (c.x - b.x) +
					 (sqr(b.x) + sqr(b.y)) * (a.x - c.x) +
					 (sqr(c.x) + sqr(c.y)) * (b.x - a.x)),
  };
}

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
  const locs = Object.keys(chipotles).map(x => {
	 const parts = x.split(',');
	 return {
		x: parseFloat(parts[0]),
		y: parseFloat(parts[1])
	 }
  });

  let record = 1000000;
  let best = undefined;
  for (let i = 0; i < locs.length; i++) {
	 const pi = locs[i];
	 for (let j = i+1; j < locs.length; j++) {
		const pj = locs[j];
		for (let k = j+1; k < locs.length; k++) {
		  const pk = locs[k];
		  const c = circumcenter(pi, pj, pk);
		  console.log(pi, pj, pk);
		  console.log(c);
		  const d = sdist(c, pi); // XXX this is totally wrong because
										  // I'm pretending lat/lng is x/y, but
										  // maybe it'll give an approximately
										  // correct ranking
		  if (d < record) {
			 record = d;
			 best = [pi, pj, pk];
		  }
		}
	 }
  }
  console.log(best, record);
}

go().then(x => console.log(x)).catch(x => console.error(x));
