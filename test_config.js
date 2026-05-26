const config = {
  "title": { "text": "Test Wind Rose" },
  "polar": {},
  "angleAxis": { "type": "category", "data": ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] },
  "radiusAxis": {},
  "series": [
    {
      "type": "bar",
      "data": [1, 2, 3, 4, 5, 6, 7, 8],
      "coordinateSystem": "polar",
      "stack": "total"
    },
    {
      "type": "bar",
      "data": [8, 7, 6, 5, 4, 3, 2, 1],
      "coordinateSystem": "polar",
      "stack": "total"
    }
  ]
};

console.log(JSON.stringify(config));
