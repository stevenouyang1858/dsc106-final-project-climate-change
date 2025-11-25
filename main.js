import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

const svg = d3.select("#map");
const width = +svg.attr("width") || 960;
const height = +svg.attr("height") || 500;

const projection = d3.geoNaturalEarth1()
  .scale(160)
  .translate([width / 2, height / 2]);

const path = d3.geoPath().projection(projection);

d3.json("./countries.geojson").then(world => {
  svg.append("g")
    .selectAll("path")
    .data(world.features)
    .join("path")
      .attr("class", "country")    // use CSS styling
      .attr("d", path);
});
