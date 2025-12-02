import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import scrollama from 'https://cdn.jsdelivr.net/npm/scrollama@3.2.0/+esm';



//scatter plot

function drawCO2TempScatter(containerId, csvPath) {
    const margin = { top: 40, right: 40, bottom: 60, left: 80 };
    const width = 800 - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;

    // Remove any existing SVG
    d3.select(`#${containerId}`).selectAll("svg").remove();

    const svg = d3.select(`#${containerId}`)
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
      .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // load
    d3.csv(csvPath, d => ({
        year: +d.time,
        co2: +d.co2 / 1e14,
        temp: +d.temp
    })).then(data => {
        // color scale by year
        const color = d3.scaleSequential()
            .domain(d3.extent(data, d => d.year))
            .interpolator(d3.interpolateViridis);

        // Scales
        const x = d3.scaleLinear()
            .domain([d3.min(data, d => d.co2) * 0.95, d3.max(data, d => d.co2) * 1.05])
            .range([0, width]);

        const y = d3.scaleLinear()
            .domain([d3.min(data, d => d.temp) * 1, d3.max(data, d => d.temp) * 1.1])
            .range([height, 0]);

        // Axes
        svg.append("g")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(x));
        
        svg.append("g")
            .call(d3.axisLeft(y));

        // axis label
        svg.append("text")
            .attr("x", width / 2)
            .attr("y", height + 45)
            .attr("text-anchor", "middle")
            .attr("font-size", "14px")
            .text("CO₂ Mass (× 10¹⁴ kg)");

        svg.append("text")
            .attr("x", -height / 2)
            .attr("y", -50)
            .attr("transform", "rotate(-90)")
            .attr("text-anchor", "middle")
            .attr("font-size", "14px")
            .text("Surface Temperature Anomoly (°C)");

        // Add chart title
        svg.append("text")
            .attr("class", "chart-title")
            .attr("x", width / 2)
            .attr("y", -margin.top / 2)
            .attr("text-anchor", "middle")
            .style("font-size", "20px")
            .style("font-weight", "600")
            .text("CO₂ Mass vs Surface Temperature Anomaly");

        // tooltip
        const tooltip = d3.select("body")
            .append("div")
            .attr("class", "tooltip")
            .style("position", "fixed")
            .style("background", "white")
            .style("border", "1px solid #ccc")
            .style("padding", "5px")
            .style("pointer-events", "none")
            .style("opacity", 0);

        // points
        svg.selectAll("circle")
            .data(data)
            .join("circle")
            .attr("cx", d => x(d.co2))
            .attr("cy", d => y(d.temp))
            .attr("r", 5)
            .attr("fill", d => color(d.year))
            .on("mouseover", (event, d) => {
                tooltip.html(`Year: ${d.year}<br>CO₂: ${d.co2}<br>Temp: ${d.temp}`)
                    .style("left", (event.clientX + 10) + "px")
                    .style("top", (event.clientY + 10) + "px")
                    .style("opacity", 0.9);
            })
            .on("mouseout", () => tooltip.style("opacity", 0));

        // LINEAR REGRESSION
        function linearRegression(points) {
            const n = points.length;
            const sumX = d3.sum(points, d => d.co2);
            const sumY = d3.sum(points, d => d.temp);
            const sumXY = d3.sum(points, d => d.co2 * d.temp);
            const sumX2 = d3.sum(points, d => d.co2 * d.co2);

            const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
            const intercept = (sumY - slope * sumX) / n;

            return { slope, intercept };
        }

        const { slope, intercept } = linearRegression(data);

        // regression line endpoints (across full x-domain)
        const xMin = d3.min(data, d => d.co2);
        const xMax = d3.max(data, d => d.co2);

        const extendedXMax = xMax * 1.05;

        const regPoints = [
            { co2: xMin, temp: slope * xMin + intercept },
            { co2: extendedXMax, temp: slope * extendedXMax + intercept }
        ];

        // --- Draw regression line ---
        svg.append("line")
            .attr("x1", x(regPoints[0].co2))
            .attr("y1", y(regPoints[0].temp))
            .attr("x2", x(regPoints[1].co2))
            .attr("y2", y(regPoints[1].temp))
            .attr("stroke", "blue")
            .attr("stroke-dasharray", "6 4") 
            .attr("stroke-width", 2)
            .attr("opacity", 0.8);

        svg.append("path")
            .datum(regPoints)
            .attr("class", "regression-line-hover")
            .attr("fill", "none")
            .attr("stroke", "transparent")
            .attr("stroke-width", 30)
            .style("pointer-events", "stroke")
            .attr("d", d3.line()
                .x(d => x(d.co2))
                .y(d => y(d.temp))
            );
        
        const regTooltip = d3.select("body")
            .append("div")
            .attr("class", "tooltip")
            .style("position", "fixed")
            .style("background", "white")
            .style("border", "1px solid #ccc")
            .style("padding", "5px")
            .style("pointer-events", "none")
            .style("opacity", 0);

        const hoverDot = svg.append("circle")
            .attr("r", 6)
            .attr("fill", "blue")
            .attr("stroke", "white")
            .attr("stroke-width", 2)
            .attr("opacity", 0);

        svg.select(".regression-line-hover")
            .on("mousemove", (event) => {
                const mouseX = x.invert(event.offsetX - margin.left);

                // clamp to regression range
                const clampedX = Math.max(
                    Math.min(mouseX, regPoints[1].co2),
                    regPoints[0].co2
                );

                // compute predicted temp
                const predTemp = slope * clampedX + intercept;

                hoverDot
                    .attr("cx", x(clampedX))
                    .attr("cy", y(predTemp))
                    .attr("opacity", 1);

                regTooltip.html(
                    `Predicted CO₂: ${clampedX.toFixed(2)}<br>` +
                    `Predicted Surface Temperature Anomoly: ${predTemp.toFixed(3)}°C`
                )
                .style("left", (event.clientX + 10) + "px")
                .style("top", (event.clientY + 10) + "px")
                .style("opacity", 0.9);
            })
            .on("mouseout", () => {
                regTooltip.style("opacity", 0);
                hoverDot.attr("opacity", 0);
            });


    }).catch(err => console.error(err));
};













// LINE PLOT

let visibleLines = [];
function drawLegend(svg, width, colorMap) {
    const legendData = [
        { name: "Historical", color: "black" },
        { name: "SSP1-2.6", color: "teal" },
        { name: "SSP2-4.5", color: "blue" },
        { name: "SSP3-7.0", color: "orange" },
        { name: "SSP5-8.5", color: "red" }
    ];

    // Remove old legend if any
    svg.selectAll(".legend").remove();

    const legend = svg.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${width + 20}, 20)`); // position right of chart

    // draw colored squares
    legend.selectAll("rect")
        .data(legendData)
        .join("rect")
        .attr("class", d => "legend-rect legend-" + d.name.replaceAll('.', '').replaceAll('-', ''))
        .attr("x", 0)
        .attr("y", (d, i) => i * 20)
        .attr("width", 12)
        .attr("height", 12)
        .attr("fill", d => d.color);

    // draw labels
    legend.selectAll("text")
        .data(legendData)
        .join("text")
        .attr("class", d => "legend-label legend-" + d.name.replaceAll('.', '').replaceAll('-', ''))
        .attr("x", 18)
        .attr("y", (d, i) => i * 20 + 10)
        .text(d => d.name)
        .attr("font-size", "12px");
}

//global variable for line chart
let lineChartState = {};

// drawing line chart
function drawCO2LineChart(containerId, historicalCSV, predictionsCSV) {
    const margin = { top: 60, right: 120, bottom: 40, left: 140 };
    const width = 900 - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;

    let lastMouseX = 0;
    let lastMouseY = 0;

    // Remove any existing SVG
    d3.select(`#${containerId}`).selectAll("svg").remove();

    const svg = d3.select(`#${containerId}`)
      .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
      .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear().range([0, width]);
    const y = d3.scaleLinear().range([height, 0]);

    const line = d3.line()
        .x(d => x(d.year))
        .y(d => y(d.value));

    const colorMap = {
        ssp126: "teal",
        ssp245: "blue",
        ssp370: "orange",
        ssp585: "red"
    };

    const tooltip = d3.select("body")
        .append("div")
        .attr("class", "tooltip line-tooltip")
        .style("position", "fixed")
        .style("background", "white")
        .style("border", "1px solid #ccc")
        .style("padding", "5px")
        .style("pointer-events", "none")
        .style("opacity", 0)
        .style("font-size", "14px")
        .style("font-family", "Arial, sans-serif");

    // Load CSV data
    Promise.all([
        d3.csv(historicalCSV, d => ({ year: +d.time, value: +d.co2mass / 1e14 })),
        d3.csv(predictionsCSV, d => ({
            year: +d.time,
            ssp126: +d["SSP1-2.6"] / 1e14,
            ssp245: +d["SSP2-4.5"] / 1e14,
            ssp370: +d["SSP3-7.0"] / 1e14,
            ssp585: +d["SSP5-8.5"] / 1e14
        }))
    ]).then(([historical, predictions]) => {

        const allYears = historical.map(d => d.year).concat(predictions.map(d => d.year));
        x.domain(d3.extent(allYears));

        const allValues = [
            ...historical.map(d => d.value),
            ...predictions.flatMap(d => [d.ssp126, d.ssp245, d.ssp370, d.ssp585])
        ];
        y.domain([d3.min(allValues)*0.95, d3.max(allValues)*1.05]);

        // Axes
        svg.append("g").attr("class", "x axis")
            .attr("transform", `translate(0,${height})`).call(d3.axisBottom(x).tickFormat(d3.format("d")));
        svg.append("g").attr("class", "y axis").call(d3.axisLeft(y));

        //title
        svg.append("text")
            .attr("class", "chart-title")
            .attr("x", width / 2)
            .attr("y", -10)
            .attr("text-anchor", "middle")
            .style("font-size", "20px")
            .style("font-weight", "600")
            .text("Historical & Projected Atmospheric CO₂ Levels");
        //axis label
        svg.append("text")
            .attr("class", "x axis-label")
            .attr("text-anchor", "middle")
            .attr("x", width / 2)
            .attr("y", height + 35)
            .text("Year");

        svg.append("text")
            .attr("class", "y axis-label")
            .attr("text-anchor", "middle")
            .attr("transform", "rotate(-90)")
            .attr("x", -height / 2)
            .attr("y", -60)
            .text("Atmospheric CO₂ mass (× 10¹⁴ kg)");


        //vertical line at 2015
        svg.append("line")
            .attr("class", "divider-line")
            .attr("x1", x(2015))
            .attr("x2", x(2015))
            .attr("y1", 0)
            .attr("y2", height)
            .attr("stroke", "black")
            .attr("stroke-width", 2)
            .attr("stroke-dasharray", "4 2");

        // Historical line
        svg.append("path")
            .datum(historical)
            .attr("class", "line historical")
            .attr("stroke", "black")
            .attr("fill", "none")
            .attr("stroke-width", 2)
            .attr("d", line);

        // Hover overlay line
        const hoverLine = svg.append("line")
            .attr("class", "hover-line")
            .attr("y1", 0).attr("y2", height)
            .attr("stroke", "gray")
            .attr("stroke-width", 1)
            .attr("stroke-dasharray", "4 2")
            .style("opacity", 0);

        svg.append("rect")
            .attr("class", "overlay")
            .attr("width", width).attr("height", height)
            .attr("fill", "none")
            .attr("pointer-events", "all")
            .on("mousemove", function(event) {
            const [mx] = d3.pointer(event);
            const yearScale = x.invert(mx);

            lastMouseX = event.clientX;
            lastMouseY = event.clientY;

            const nearestYear = allYears.reduce((a, b) =>
                Math.abs(b - yearScale) < Math.abs(a - yearScale) ? b : a
            );

        hoverLine
            .attr("x1", x(nearestYear))
            .attr("x2", x(nearestYear))
            .style("opacity", 1);

        let text = `<strong>Year:</strong> ${nearestYear}<br>`;
        const hist = historical.find(d => d.year === nearestYear);
        if(hist) text += `<strong>Historical:</strong> ${hist.value}<br>`;

        predictions.forEach(row => {
            if(row.year === nearestYear){
                visibleLines.forEach(key => {
                    if(row[key] !== undefined) text += `<strong>${key}:</strong> ${row[key].toFixed(3)}<br>`;
                });
            }
        });

        tooltip.html(text)
            .style("left", (lastMouseX + 15) + "px")
            .style("top", (lastMouseY + 15) + "px") 
            .style("opacity", 0.9);
    })
    .on("mouseout", () => {
        tooltip.style("opacity", 0);
        hoverLine.style("opacity", 0);
    });

    window.addEventListener("scroll", () => {
        if (tooltip.style("opacity") > 0) { 
            tooltip
                .style("left", (lastMouseX + 15) + "px")
                .style("top", (lastMouseY + 15) + "px");
        }
    });


        // Draw legend
        drawLegend(svg, width, colorMap);

        // Save state for scrollytelling
        lineChartState = { svg, x, y, line, colorMap, predictions, width, height };

        // setup scrollama
        setupScrollama();

    }).catch(err => console.error(err));
}

// main part of scrollytelling
function drawPredictionLine(key) {
    const { svg, line, colorMap, predictions } = lineChartState;
    svg.append("path")
       .datum(predictions.map(d => ({ year: d.year, value: d[key] })))
       .attr("class", `line prediction ${key}`)
       .attr("stroke", colorMap[key])
       .attr("fill", "none")
       .attr("stroke-width", 2)
       .attr("d", line)
       .transition()
       .duration(400)
       .attr("opacity", 1);
}

function removePredictionLines() {
    const { svg } = lineChartState;
    svg.selectAll(".line.prediction").transition()
        .duration(400)
        .attr("opacity", 0)
        .remove();;
}
function updateLegendHighlight() {
    const legendMap = {
        historical: "Historical",
        ssp126: "SSP1-2.6",
        ssp245: "SSP2-4.5",
        ssp370: "SSP3-7.0",
        ssp585: "SSP5-8.5"
    };

    // Reset all legend items to dim
    d3.selectAll(".legend-rect, .legend-label").classed("legend-active", false);

    // Activate only visible lines
    visibleLines.forEach(key => {
        const name = legendMap[key];
        const cls = ".legend-" + name.replaceAll('.', '').replaceAll('-', '');

        d3.selectAll(cls).classed("legend-active", true);
    });

    // Always highlight historical
    if (visibleLines.length === 0 || visibleLines.includes("historical")) {
        d3.selectAll(".legend-Historical").classed("legend-active", true);
    }

    d3.selectAll(".legend-Historical").classed("legend-active", true);
}

function drawSelectedPredictionLines(keys) {
    removePredictionLines();
    keys.forEach(k => drawPredictionLine(k));
    visibleLines = keys;
}

function showText(text) {
    d3.select("#story-text").html(text);
}

function updateSSPCheckboxColors() {
    document.querySelectorAll('.ssp-option').forEach(label => {
        const input = label.querySelector('input');
        const color = label.getAttribute('data-color');

        if(input.checked){
            label.style.backgroundColor = color; 
            label.style.color = 'white';           
            label.style.border = `2px solid ${color}`;
        } else {
            label.style.backgroundColor = 'white'; 
            label.style.color = 'black'; 
            label.style.border = `2px solid ${color}`; 
        }
    });
}

//Scrollama
function setupScrollama() {
    const scroller = scrollama();

    scroller.setup({
        step: "#story section",
        offset: 0.5
    }).onStepEnter(({ index }) => {
        console.log("Step triggered:", index); // sanity check
        removePredictionLines();

        switch(index) {
            case 0:
                showText("Historical CO₂ data is shown here.");
                visibleLines = [];
                updateLegendHighlight();
                break;
            case 1:
                drawPredictionLine("ssp245");
                visibleLines = ["ssp245"];
                updateLegendHighlight();
                break;
            case 2:
                drawPredictionLine("ssp245");
                drawPredictionLine("ssp370");
                drawPredictionLine("ssp585");
                visibleLines = ["ssp245","ssp370","ssp585"];
                updateLegendHighlight();
                break;
            case 3:
                drawPredictionLine("ssp245");
                drawPredictionLine("ssp370");
                drawPredictionLine("ssp585");
                drawPredictionLine("ssp126");
                visibleLines = ["ssp245","ssp370","ssp585","ssp126"];
                updateLegendHighlight();
                break;
            case 4:
                drawSelectedPredictionLines(["ssp126","ssp245","ssp370","ssp585"]);
                visibleLines = ["ssp126","ssp245","ssp370","ssp585"];
                updateLegendHighlight();

                d3.selectAll('#ssp-options input[type="checkbox"]').on('change', function() {
                    const selectedScenarios = Array.from(document.querySelectorAll('#ssp-options input:checked'))
                        .map(input => input.value);
                    drawSelectedPredictionLines(selectedScenarios);
                    updateSSPCheckboxColors(); // <-- sync colors when toggled
                    updateLegendHighlight();    // <-- keep legend in sync
                });
                updateSSPCheckboxColors();
                break;
        }
    });

    window.addEventListener("resize", scroller.resize);
    
}

// Stripe and Map 
function initStripesAndCountryMap() {
  const stripesCsv = "./data/global_temp_anomaly_1950_2050.csv";
  const countryCsv = "./data/country_temp_anomaly_1950_2050.csv";
  const worldGeoJsonPath = "world.geojson";

  const stripeMargin = { top: 10, right: 10, bottom: 20, left: 10 };
  const stripeWidth = 960;
  const stripeHeight = 80;

  const mapWidth = 1000;
  const mapHeight = 460;

  let activeCountry = null;
  let countriesGroup;

  const noDataColor = "#e0e0e0";

  const stripeSvg = d3.select("#stripe-container")
    .append("svg")
    .attr("width", stripeWidth)
    .attr("height", stripeHeight);

  stripeSvg.append("rect")
    .attr("class", "stripe-background")
    .attr("x", 0)
    .attr("y", 0)
    .attr("width", stripeWidth)
    .attr("height", stripeHeight);

  const mapSvg = d3.select("#map-container")
    .append("svg")
    .attr("width", mapWidth)
    .attr("height", mapHeight);

  const projection = d3.geoNaturalEarth1()
    .scale(170)
    .translate([mapWidth / 2, mapHeight / 2]);

  const path = d3.geoPath().projection(projection);

  const infoText = d3.select("#info-text");
  const mapYearLabel = d3.select("#map-year-label");
  const mapTitle = d3.select("#map-title");
  const tooltip = d3.select("#tooltip");

  let worldFeatures;
  let stripesData;
  let countryData;
  let countryByYear;

  let stripeXScale;
  let stripeColorScale;
  let mapColorScale;

  let selectedYear = null;
  
  // load data
  Promise.all([
    d3.csv(stripesCsv, d3.autoType),
    d3.csv(countryCsv, d3.autoType),
    d3.json(worldGeoJsonPath)
  ]).then(([stripes, countryRows, worldGeo]) => {
    stripes.forEach(d => {
      if (typeof d.is_future === "string") {
        d.is_future = d.is_future.toLowerCase() === "true";
      } else {
        d.is_future = !!d.is_future;
      }
    });

    stripes.sort((a, b) => d3.ascending(a.year, b.year));
    stripesData = stripes;

    countryData = countryRows;
    countryByYear = d3.group(countryData, d => d.year);

    worldFeatures = worldGeo.features;

    // color scales
    const stripeAnoms = stripesData.map(d => d.anomaly);
    const stripeLo = d3.quantile(stripeAnoms, 0.02);
    const stripeHi = d3.quantile(stripeAnoms, 0.98);

    stripeColorScale = d3.scaleDiverging()
      .domain([stripeHi, 0, stripeLo])
      .interpolator(d3.interpolateRdBu)
      .clamp(true)
      .unknown("#f0f0f0");


    // color scale for map
    const mapAnoms = countryData.map(d => d.anomaly);
    const mapLo = d3.quantile(mapAnoms, 0.02);
    const mapHi = d3.quantile(mapAnoms, 0.98);

    mapColorScale = d3.scaleDiverging()
      .domain([mapHi, 0, mapLo])
      .interpolator(d3.interpolateRdBu)
      .clamp(true)
      .unknown("#f0f0f0");

    drawStripes();
    drawMapBase();

    const defaultYear =
      stripesData.find(d => !d.is_future)?.year ||
      stripesData[Math.floor(stripesData.length / 2)].year;

    setSelectedYear(defaultYear);
    const searchInput = document.getElementById("country-search");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        const query = e.target.value.trim().toLowerCase();

        mapSvg.selectAll(".country")
          .attr("stroke", d =>
            query && d.properties.name.toLowerCase().includes(query)
              ? "black"
              : "#999"
          )
          .attr("stroke-width", d =>
            query && d.properties.name.toLowerCase().includes(query)
              ? 1.5
              : 0.6
          )
          .attr("opacity", d =>
            query && !d.properties.name.toLowerCase().includes(query)
              ? 0.4
              : 1
          );
      });
    }
  });
  

  // stripes 
  function drawStripes() {
    const years = stripesData.map(d => d.year);

    stripeXScale = d3.scaleBand()
      .domain(years)
      .range([stripeMargin.left, stripeWidth - stripeMargin.right])
      .paddingInner(0);

    const g = stripeSvg.append("g");

    g.selectAll("rect.stripe")
      .data(stripesData, d => d.year)
      .enter()
      .append("rect")
      .attr("class", d => "stripe" + (d.is_future ? " future" : ""))
      .attr("x", d => stripeXScale(d.year))
      .attr("y", stripeMargin.top)
      .attr("width", d => Math.max(1, stripeXScale.bandwidth()))
      .attr("height", stripeHeight - stripeMargin.top - stripeMargin.bottom)
      .attr("fill", d => stripeColorScale(d.anomaly))
      .on("mouseover", function (event, d) {
        const sign = d.anomaly >= 0 ? "+" : "";
        const rounded = d3.format(".2f")(d.anomaly);
        const era = d.is_future ? "Projected (ssp245)" : "Historical data";

        infoText.html(
          `<strong>${d.year}</strong>: ${sign}${rounded} °C vs 1950–1980<br>` +
          `<span style="color:#aaa">${era}</span>`
        );

        d3.select(this).raise();
      })
      .on("mouseout", function () {
        if (selectedYear == null) {
          infoText.text(
            "Hover a stripe to see the global temperature anomaly for that year. " +
            "Click a stripe to update the world map below with country-level anomalies."
          );
        } else {
          const sel = stripesData.find(d => d.year === selectedYear);
          const sign = sel.anomaly >= 0 ? "+" : "";
          const rounded = d3.format(".2f")(sel.anomaly);
          const era = sel.is_future ? "Projected (ssp245)" : "Historical data";
          infoText.html(
            `<strong>${sel.year}</strong>: ${sign}${rounded} °C vs 1950–1980<br>` +
            `<span style="color:#aaa">${era} — currently displayed on the map.</span>`
          );
        }
      })
      .on("click", (event, d) => {
        setSelectedYear(d.year);

        const mapEl = document.getElementById("map-container");
        if (mapEl) {
            mapEl.scrollIntoView({
            behavior: "smooth",
            block: "center"
            });
        }
      });


      const xAxis = gAxis => gAxis
      .attr("transform", `translate(0,${stripeHeight - stripeMargin.bottom})`)
      .call(
        d3.axisBottom(stripeXScale)
          .tickValues(years.filter(y => y % 10 === 0))
          .tickSize(3)
      )
      .call(g => g.selectAll("text")
        .attr("fill", "#000")
        .attr("font-size", 10))
      .call(g => g.selectAll("line").attr("stroke", "#777"))
      .call(g => g.select(".domain").attr("stroke", "#777"));

    stripeSvg.append("g").call(xAxis);
    const futureYears = stripesData.filter(d => d.is_future);
    const histYears   = stripesData.filter(d => !d.is_future);

    if (futureYears.length > 0 && histYears.length > 0) {
      const firstFutureYear = d3.min(futureYears, d => d.year);
      const lastHistYear    = d3.max(histYears, d => d.year);

      const xHistRight  = stripeXScale(lastHistYear) + stripeXScale.bandwidth();
      const xFutureLeft = stripeXScale(firstFutureYear);
      const xBoundary   = (xHistRight + xFutureLeft) / 2;

      stripeSvg.append("line")
        .attr("x1", xBoundary)
        .attr("x2", xBoundary)
        .attr("y1", stripeMargin.top)
        .attr("y2", stripeHeight - stripeMargin.bottom)
        .attr("stroke", "#000")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "4,4")
        .attr("opacity", 0.8);

      const labelY = stripeMargin.top + 18;

      //label
      stripeSvg.append("text")
        .attr("class", "phase-label")
        .attr("x", xBoundary - 6)
        .attr("y", labelY)
        .attr("text-anchor", "end")
        .text("Historical");

      stripeSvg.append("text")
        .attr("class", "phase-label")
        .attr("x", xBoundary + 6)
        .attr("y", labelY)
        .attr("text-anchor", "start")
        .text("Projected");
    }

  }

  // draw map base
  function drawMapBase() {
    mapSvg.append("rect")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", mapWidth)
      .attr("height", mapHeight)
      .attr("fill", "#ffffff");

    countriesGroup = mapSvg.append("g")
      .attr("class", "countries");

    const countries = countriesGroup
      .selectAll("path")
      .data(worldFeatures)
      .enter()
      .append("path")
      .attr("class", "country")
      .attr("d", path)
      .attr("fill", noDataColor)
      .attr("stroke", "#999")
      .attr("stroke-width", 0.6)
      .on("mousemove", function (event, d) {
        const name = d.properties.name;
        const anomaly = d.properties.anomaly;

        let html;
        if (anomaly == null || isNaN(anomaly)) {
          html = `<strong>${name}</strong><br><span style="color:#aaa">No data for this year</span>`;
        } else {
          const sign = anomaly >= 0 ? "+" : "";
          const rounded = d3.format(".2f")(anomaly);
          html = `<strong>${name}</strong><br>${sign}${rounded} °C vs 1950–1980`;
        }

        tooltip
          .style("display", "block")
          .html(html)
          .style("left", (event.pageX + 12) + "px")
          .style("top", (event.pageY + 12) + "px");
      })
      .on("mouseout", function () {
        tooltip.style("display", "none");
      })
      .on("click", function (event, d) {
        if (activeCountry === d) {
          activeCountry = null;
          countriesGroup
            .transition()
            .duration(750)
            .attr("transform", "translate(0,0) scale(1)");
          return;
        }

        activeCountry = d;

        const [[x0, y0], [x1, y1]] = path.bounds(d);
        const dx = x1 - x0;
        const dy = y1 - y0;
        const x = (x0 + x1) / 2;
        const y = (y0 + y1) / 2;

        const scale = Math.min(
          4,
          0.9 / Math.max(dx / mapWidth, dy / mapHeight)
        );

        const translateX = mapWidth / 2 - scale * x;
        const translateY = mapHeight / 2 - scale * y;

        countriesGroup
          .transition()
          .duration(750)
          .attr("transform", `translate(${translateX},${translateY}) scale(${scale})`);
      });
  }

  // update map for year
  function updateMapForYear(year) {
    const rows = countryByYear.get(year) || [];
    const byName = new Map(rows.map(d => [d.CountryName, d]));

    const countries = mapSvg.selectAll("path.country");

    countries.each(function (d) {
      const row = byName.get(d.properties.name);
      d.properties.anomaly = row ? row.anomaly : null;
    });

    // fill colors map update
    countries
      .transition()
      .duration(600)
      .attr("fill", d => {
        const a = d.properties.anomaly;
        return a == null || isNaN(a) ? noDataColor : mapColorScale(a);
      });

    const txt = `Country-level anomalies in ${year} (vs 1950–1980 baseline)`;
    mapTitle.text("Country Anomaly Map");
    mapYearLabel.text(txt);
  }

  // set selected year
  function setSelectedYear(year) {
    selectedYear = year;

    stripeSvg.selectAll("rect.stripe")
      .classed("selected", d => d.year === year);

    updateMapForYear(year);

    const sel = stripesData.find(d => d.year === year);
    if (sel) {
      const sign = sel.anomaly >= 0 ? "+" : "";
      const rounded = d3.format(".2f")(sel.anomaly);
      const era = sel.is_future ? "Projected (ssp245)" : "Historical data";

      infoText.html(
        `<strong>${sel.year}</strong>: ${sign}${rounded} °C vs 1950–1980<br>` +
        `<span style="color:#aaa">${era} — currently displayed on the map.</span>`
      );
    }
  }
}




drawCO2TempScatter("scatterplot", "./data/co2_surfacetemp_biannual_scatterplot_1950_2014.csv");

// Call line function
drawCO2LineChart(
    "linechart",
    "./data/co2mass_historical_1950_2014_yearly.csv",
    "./data/co2mass_ssp_predictions_yearly.csv"
);

drawRegionalComparison("regional-comparison", "./data/country_temp_anomaly_1950_2050.csv");

drawSeaIceConcentration("decade-warming", "./data/siconc_annual_mean_polar.csv");
function drawRegionalComparison(containerId, csvPath) {
    const margin = { top: 40, right: 200, bottom: 60, left: 80 };
    const width = 1000 - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;

    d3.select(`#${containerId}`).selectAll("svg").remove();

    const svg = d3.select(`#${containerId}`)
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

   
    const defaultCountries = ["United States", "China", "India", "Brazil", "Russia", "Australia", "Canada", "Germany"];
    let selectedCountries = [...defaultCountries];
    let allData = null;

    // Color scale for countries
    const countryColors = [
        "#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", 
        "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf",
        "#aec7e8", "#ffbb78", "#98df8a", "#ff9896", "#c5b0d5"
    ];

    const colorScale = d3.scaleOrdinal()
        .domain([])
        .range(countryColors);

    // Load data
    d3.csv(csvPath, d => ({
        country: d.CountryName,
        year: +d.year,
        anomaly: +d.anomaly
    })).then(data => {
        allData = data;

        const historicalData = data.filter(d => d.year <= 2014);

        const countryDataCounts = d3.rollup(
            historicalData,
            v => v.length,
            d => d.country
        );
        const uniqueCountries = Array.from(countryDataCounts.entries())
            .filter(([country, count]) => count >= 10)
            .map(([country]) => country)
            .sort();

        const validDefaultCountries = defaultCountries.filter(c => uniqueCountries.includes(c));
        if (validDefaultCountries.length === 0 && uniqueCountries.length > 0) {
            selectedCountries = uniqueCountries.slice(0, 6);
        } else {
            selectedCountries = validDefaultCountries.length > 0 ? validDefaultCountries : uniqueCountries.slice(0, 6);
        }

        // Scales
        const x = d3.scaleLinear()
            .domain(d3.extent(historicalData, d => d.year))
            .range([0, width]);

        const y = d3.scaleLinear()
            .domain(d3.extent(historicalData, d => d.anomaly))
            .range([height, 0]);

        // Line generator
        const line = d3.line()
            .x(d => x(d.year))
            .y(d => y(d.anomaly))
            .curve(d3.curveMonotoneX);

        // Axes
        svg.append("g")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(x).tickFormat(d3.format("d")));

        svg.append("g")
            .call(d3.axisLeft(y));

        // Axis labels
        svg.append("text")
            .attr("x", width / 2)
            .attr("y", height + 45)
            .attr("text-anchor", "middle")
            .attr("font-size", "14px")
            .text("Year");

        svg.append("text")
            .attr("x", -height / 2)
            .attr("y", -50)
            .attr("transform", "rotate(-90)")
            .attr("text-anchor", "middle")
            .attr("font-size", "14px")
            .text("Temperature Anomaly (°C)");

        // Chart title
        svg.append("text")
            .attr("class", "chart-title")
            .attr("x", width / 2)
            .attr("y", -margin.top / 2)
            .attr("text-anchor", "middle")
            .style("font-size", "20px")
            .style("font-weight", "600")
            .text("Regional Temperature Trends: Different Places, Different Warming Rates");

        // Tooltip
        const tooltip = d3.select("body")
            .append("div")
            .attr("class", "tooltip")
            .style("position", "fixed")
            .style("background", "white")
            .style("border", "1px solid #ccc")
            .style("padding", "8px")
            .style("border-radius", "4px")
            .style("pointer-events", "none")
            .style("opacity", 0)
            .style("font-size", "12px");

        // Country selection controls
        const controlBox = d3.select(`#${containerId}`)
            .append("div")
            .style("position", "absolute")
            .style("left", (width + margin.left + 20) + "px")
            .style("top", (margin.top + 40) + "px")
            .style("width", "180px");

        controlBox.append("div")
            .style("font-weight", "bold")
            .style("margin-bottom", "10px")
            .text("Select Countries:");

        const countryCheckboxes = controlBox.append("div")
            .attr("id", "country-checkboxes");

        // Update function to draw lines
        function updateLines() {
            const filteredData = historicalData.filter(d => selectedCountries.includes(d.country));
            
            // Group by country
            const dataByCountry = d3.group(filteredData, d => d.country);
            
            colorScale.domain(selectedCountries);

            // Remove old lines
            svg.selectAll(".country-line").remove();
            svg.selectAll(".country-points").remove();

            // Draw lines
            dataByCountry.forEach((values, country) => {
                const sortedValues = Array.from(values).sort((a, b) => a.year - b.year);
                const color = colorScale(country);

                // Line
                svg.append("path")
                    .datum(sortedValues)
                    .attr("class", "country-line")
                    .attr("fill", "none")
                    .attr("stroke", color)
                    .attr("stroke-width", 2.5)
                    .attr("d", line)
                    .style("opacity", 0.8);

                // Points with hover
                svg.selectAll(`.point-${country.replace(/\s+/g, '-')}`)
                    .data(sortedValues)
                    .join("circle")
                    .attr("class", `country-points point-${country.replace(/\s+/g, '-')}`)
                    .attr("cx", d => x(d.year))
                    .attr("cy", d => y(d.anomaly))
                    .attr("r", 3)
                    .attr("fill", color)
                    .style("opacity", 0)
                    .on("mouseover", function(event, d) {
                        tooltip.html(`
                            <strong>${country}</strong><br>
                            Year: ${d.year}<br>
                            Anomaly: ${d.anomaly.toFixed(2)}°C
                        `)
                        .style("left", (event.pageX + 10) + "px")
                        .style("top", (event.pageY - 10) + "px")
                        .style("opacity", 1);
                        
                        d3.select(this).attr("r", 5).style("opacity", 1);
                    })
                    .on("mouseout", function() {
                        tooltip.style("opacity", 0);
                        d3.select(this).attr("r", 3).style("opacity", 0);
                    })
                    .on("mouseenter", function() {
                        svg.selectAll(`.point-${country.replace(/\s+/g, '-')}`)
                            .style("opacity", 0.6);
                    })
                    .on("mouseleave", function() {
                        // Hide points again
                        svg.selectAll(`.point-${country.replace(/\s+/g, '-')}`)
                            .style("opacity", 0);
                    });
            });

            // Update legend
            updateLegend();
        }

        // Legend
        function updateLegend() {
            svg.selectAll(".legend").remove();

            const legend = svg.append("g")
                .attr("class", "legend")
                .attr("transform", `translate(${width + 20}, 20)`);

            selectedCountries.forEach((country, i) => {
                const legendItem = legend.append("g")
                    .attr("class", "legend-item")
                    .attr("transform", `translate(0, ${i * 20})`);

                legendItem.append("line")
                    .attr("x1", 0)
                    .attr("x2", 15)
                    .attr("y1", 0)
                    .attr("y2", 0)
                    .attr("stroke", colorScale(country))
                    .attr("stroke-width", 2.5);

                legendItem.append("text")
                    .attr("x", 20)
                    .attr("y", 4)
                    .attr("font-size", "11px")
                    .text(country);
            });
        }

        const topCountries = uniqueCountries.slice(0, 25);
        topCountries.forEach(country => {
            const checkboxContainer = countryCheckboxes.append("div")
                .style("margin-bottom", "5px");

            checkboxContainer.append("input")
                .attr("type", "checkbox")
                .attr("value", country)
                .attr("id", `checkbox-${country.replace(/\s+/g, '-')}`)
                .property("checked", selectedCountries.includes(country))
                .on("change", function() {
                    if (this.checked) {
                        if (!selectedCountries.includes(country)) {
                            selectedCountries.push(country);
                        }
                    } else {
                        selectedCountries = selectedCountries.filter(c => c !== country);
                    }
                    updateLines();
                });

            checkboxContainer.append("label")
                .attr("for", `checkbox-${country.replace(/\s+/g, '-')}`)
                .style("margin-left", "5px")
                .style("font-size", "11px")
                .style("cursor", "pointer")
                .text(country);
        });

        // Initial draw
        updateLines();

    }).catch(err => console.error(err));
}

function drawSeaIceConcentration(containerId, csvPath) {
    const margin = { top: 40, right: 40, bottom: 60, left: 80 };
    const width = 900 - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;

    d3.select(`#${containerId}`).selectAll("svg").remove();

    const svg = d3.select(`#${containerId}`)
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Load data
    d3.csv(csvPath, d => ({
        year: +d.year,
        siconc: +d.siconc,
        scenario: d.scenario
    })).then(data => {
        const historicalData = data.filter(d => d.scenario === "historical");
        const projectedData = data.filter(d => d.scenario === "ssp245");

        // Combine all years for domain
        const allYears = data.map(d => d.year);

        // Scales
        const x = d3.scaleLinear()
            .domain(d3.extent(allYears))
            .range([0, width]);

        const y = d3.scaleLinear()
            .domain([d3.min(data, d => d.siconc) * 0.9, d3.max(data, d => d.siconc) * 1.05])
            .range([height, 0]);

        // Line generator
        const line = d3.line()
            .x(d => x(d.year))
            .y(d => y(d.siconc))
            .curve(d3.curveMonotoneX);

        // Axes
        svg.append("g")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(x).tickFormat(d3.format("d")));

        svg.append("g")
            .call(d3.axisLeft(y));

        // Axis labels
        svg.append("text")
            .attr("x", width / 2)
            .attr("y", height + 45)
            .attr("text-anchor", "middle")
            .attr("font-size", "14px")
            .text("Year");

        svg.append("text")
            .attr("x", -height / 2)
            .attr("y", -50)
            .attr("transform", "rotate(-90)")
            .attr("text-anchor", "middle")
            .attr("font-size", "14px")
            .text("Sea Ice Concentration (%)");

        // Chart title
        svg.append("text")
            .attr("class", "chart-title")
            .attr("x", width / 2)
            .attr("y", -margin.top / 2)
            .attr("text-anchor", "middle")
            .style("font-size", "20px")
            .style("font-weight", "600")
            .text("Melting Polar Ice: Sea Ice Concentration Over Time");

        // Tooltip
        const tooltip = d3.select("body")
            .append("div")
            .attr("class", "tooltip")
            .style("position", "fixed")
            .style("background", "white")
            .style("border", "1px solid #ccc")
            .style("padding", "8px")
            .style("border-radius", "4px")
            .style("pointer-events", "none")
            .style("opacity", 0)
            .style("font-size", "12px");

        // Draw historical line
        svg.append("path")
            .datum(historicalData)
            .attr("class", "ice-line historical")
            .attr("fill", "none")
            .attr("stroke", "#2563eb")
            .attr("stroke-width", 3)
            .attr("d", line);

        // Draw projected line (dashed)
        svg.append("path")
            .datum(projectedData)
            .attr("class", "ice-line projected")
            .attr("fill", "none")
            .attr("stroke", "#dc2626")
            .attr("stroke-width", 3)
            .attr("stroke-dasharray", "8 4")
            .attr("d", line);

        // Draw points for interaction
        const allData = [...historicalData, ...projectedData];
        svg.selectAll(".ice-point")
            .data(allData)
            .join("circle")
            .attr("class", "ice-point")
            .attr("cx", d => x(d.year))
            .attr("cy", d => y(d.siconc))
            .attr("r", 4)
            .attr("fill", d => d.scenario === "historical" ? "#2563eb" : "#dc2626")
            .attr("stroke", "white")
            .attr("stroke-width", 1)
            .style("opacity", 0)
            .on("mouseover", function(event, d) {
                const scenario = d.scenario === "historical" ? "Historical" : "Projected (SSP2-4.5)";
                tooltip.html(`
                    <strong>${d.year}</strong><br>
                    Sea Ice Concentration: ${d.siconc.toFixed(2)}%<br>
                    <span style="color:#666">${scenario}</span>
                `)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 10) + "px")
                .style("opacity", 1);
                
                d3.select(this).style("opacity", 1).attr("r", 6);
            })
            .on("mouseout", function() {
                tooltip.style("opacity", 0);
                d3.select(this).style("opacity", 0).attr("r", 4);
            });

        // Divider line at 2014/2015
        svg.append("line")
            .attr("class", "divider-line")
            .attr("x1", x(2014.5))
            .attr("x2", x(2014.5))
            .attr("y1", 0)
            .attr("y2", height)
            .attr("stroke", "#666")
            .attr("stroke-width", 2)
            .attr("stroke-dasharray", "4 2");

        // Legend
        const legend = svg.append("g")
            .attr("class", "legend")
            .attr("transform", `translate(${width - 200}, 30)`);

        const legendData = [
            { label: "Historical", color: "#2563eb", dash: "" },
            { label: "Projected (SSP2-4.5)", color: "#dc2626", dash: "8,4" }
        ];

        legend.selectAll("line")
            .data(legendData)
            .join("line")
            .attr("x1", 0)
            .attr("x2", 20)
            .attr("y1", (d, i) => i * 25)
            .attr("y2", (d, i) => i * 25)
            .attr("stroke", d => d.color)
            .attr("stroke-width", 3)
            .attr("stroke-dasharray", d => d.dash);

        legend.selectAll("text")
            .data(legendData)
            .join("text")
            .attr("x", 25)
            .attr("y", (d, i) => i * 25 + 5)
            .attr("font-size", "12px")
            .text(d => d.label);

        // Annotation showing decline
        if (historicalData.length > 0 && projectedData.length > 0) {
            const firstValue = historicalData[0].siconc;
            const lastValue = projectedData[projectedData.length - 1].siconc;
            const decline = firstValue - lastValue;
            const percentDecline = (decline / firstValue * 100).toFixed(1);

            svg.append("text")
                .attr("x", width / 2)
                .attr("y", height + 70)
                .attr("text-anchor", "middle")
                .attr("font-size", "12px")
                .attr("fill", "#666")
                .text(`Sea ice concentration declined by ${decline.toFixed(1)}% (${percentDecline}% decrease) from ${historicalData[0].year} to ${projectedData[projectedData.length - 1].year}`);
        }

        // Hover overlay for better interaction
        svg.append("rect")
            .attr("class", "overlay")
            .attr("width", width)
            .attr("height", height)
            .attr("fill", "none")
            .attr("pointer-events", "all")
            .on("mousemove", function(event) {
                const [mx] = d3.pointer(event);
                const yearScale = x.invert(mx);
                const nearestPoint = allData.reduce((a, b) =>
                    Math.abs(b.year - yearScale) < Math.abs(a.year - yearScale) ? b : a
                );
                
                const scenario = nearestPoint.scenario === "historical" ? "Historical" : "Projected (SSP2-4.5)";
                tooltip.html(`
                    <strong>${nearestPoint.year}</strong><br>
                    Sea Ice Concentration: ${nearestPoint.siconc.toFixed(2)}%<br>
                    <span style="color:#666">${scenario}</span>
                `)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 10) + "px")
                .style("opacity", 1);
            })
            .on("mouseout", () => {
                tooltip.style("opacity", 0);
            });

    }).catch(err => console.error(err));
}






drawCO2TempScatter("scatterplot", "./data/co2_surfacetemp_biannual_scatterplot_1950_2014.csv");

// Call line function
drawCO2LineChart(
    "linechart",
    "./data/co2mass_historical_1950_2014_yearly.csv",
    "./data/co2mass_ssp_predictions_yearly.csv"
);

initStripesAndCountryMap();

drawRegionalComparison("regional-comparison", "./data/country_temp_anomaly_1950_2050.csv");

drawDecadeWarming("decade-warming", "./data/country_temp_anomaly_1950_2050.csv");

