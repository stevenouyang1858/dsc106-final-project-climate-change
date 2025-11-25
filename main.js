import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";





// line plot interaction
function drawCO2LineChart(containerId, historicalCSV, predictionsCSV) {
    const margin = {top: 20, right: 120, bottom: 40, left: 140};
    const width = 900 - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;

    // Remove SVG
    d3.select(`#${containerId}`).selectAll("svg").remove();

    const svg = d3.select(`#${containerId}`)
      .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
      .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Scale
    const x = d3.scaleLinear().range([0, width]);
    const y = d3.scaleLinear().range([height, 0]);

    const line = d3.line()
      .x(d => x(d.year))
      .y(d => y(d.value));

    const colorMap = {
        ssp126: "green",
        ssp245: "blue",
        ssp370: "orange",
        ssp585: "red"
    };

    const tooltip = d3.select("body")
        .append("div")
            .attr("class", "tooltip")
            .style("position", "absolute")
            .style("background", "white")
            .style("border", "1px solid #ccc")
            .style("padding", "5px")
            .style("pointer-events", "none")
            .style("opacity", 0);

    // load csv
    Promise.all([
        d3.csv(historicalCSV, d => ({year: +d.time, value: +d.co2mass})),
        d3.csv(predictionsCSV, d => ({
            year: +d.time,
            ssp126: +d["SSP1-2.6"],
            ssp245: +d["SSP2-4.5"],
            ssp370: +d["SSP3-7.0"],
            ssp585: +d["SSP5-8.5"]
        }))
    ]).then(([historical, predictions]) => {

        // set domain
        const allYears = historical.map(d => d.year).concat(predictions.map(d => d.year));
        x.domain(d3.extent(allYears));

        const allValues = [
            ...historical.map(d => d.value),
            ...predictions.flatMap(d => [d.ssp126, d.ssp245, d.ssp370, d.ssp585])
        ];
        const yMin = d3.min(allValues) * 0.95; // 5% padding below
        const yMax = d3.max(allValues) * 1.05; // 5% padding above
        y.domain([yMin, yMax]);

        // axes
        svg.append("g")
            .attr("class", "x axis")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(x).tickFormat(d3.format("d")));

        svg.append("g")
            .attr("class", "y axis")
            .call(d3.axisLeft(y));

        svg.append("line")
            .attr("x1", x(2015))
            .attr("x2", x(2015))
            .attr("y1", 0)
            .attr("y2", height)
            .attr("stroke", "darkblue")
            .attr("stroke-width", 2)
            .attr("stroke-dasharray", "6 2");

        const hoverLine = svg.append("line")
            .attr("class", "hover-line")
            .attr("y1", 0)
            .attr("y2", height)
            .attr("stroke", "gray")
            .attr("stroke-width", 1)
            .attr("stroke-dasharray", "4 2")
            .style("opacity", 0);

        
        
        //draw historical line
        svg.append("path")
            .datum(historical)
            .attr("class", "line historical")
            .attr("stroke", "black")
            .attr("fill", "none")
            .attr("stroke-width", 2)
            .attr("d", line);

        //draw historical dots
        svg.append("path")
            .datum(historical)
            .attr("class", "line historical")
            .attr("stroke", "black")
            .attr("fill", "none")
            .attr("stroke-width", 2)
            .attr("d", line);

        // legend
        drawLegend(svg, width);

        function drawPredictionLines(selectedScenarios) {
            svg.selectAll(".line.prediction").remove();
            svg.selectAll(".dot.prediction").remove();

            selectedScenarios.forEach(key => {
                // line
                svg.append("path")
                    .datum(predictions.map(d => ({ year: d.year, value: d[key] })))
                    .attr("class", `line prediction ${key}`)
                    .attr("stroke", colorMap[key])
                    .attr("fill", "none")
                    .attr("stroke-width", 2)
                    .attr("d", line);

                // points
                svg.selectAll(`.dot.${key}`)
                    .data(predictions.map(d => ({ year: d.year, value: d[key] })))
                    .join("circle")
                    .attr("class", `dot prediction ${key}`)
                    .attr("cx", d => x(d.year))
                    .attr("cy", d => y(d.value))
                    .attr("r", 3)
                    .attr("fill", colorMap[key]);
            });
        }

        //initial draw
        const initialScenarios = Object.keys(colorMap);
        drawPredictionLines(initialScenarios);


        svg.append("rect")
            .attr("class", "overlay")
            .attr("width", width)
            .attr("height", height)
            .attr("fill", "none")
            .attr("pointer-events", "all")
            .on("mousemove", function (event) {
                const [mx] = d3.pointer(event);
                const yearScale = x.invert(mx);
                const nearestYear = allYears.reduce((a, b) => Math.abs(b - yearScale) < Math.abs(a - yearScale) ? b : a);

                const historicalValue = historical.find(d => d.year === nearestYear)?.value ?? "N/A";

                const selectedScenarios = Array.from(document.querySelectorAll('#ssp-options input:checked'))
                    .map(input => input.value);

                const predictionValues = {};
                selectedScenarios.forEach(key => {
                    const val = predictions.find(d => d.year === nearestYear)?.[key];
                    if (val !== undefined) predictionValues[key] = val;
                });

                let text = `Year: ${nearestYear}`;
                if (nearestYear < 2015) {
                    const historicalValue = historical.find(d => d.year === nearestYear)?.value ?? "N/A";
                    text += `<br>Historical: ${historicalValue}`;
                }
                for (const [key, val] of Object.entries(predictionValues)) {
                    text += `<br>${key}: ${val}`;
                }

                // Hide historical dots on predictive years
                svg.selectAll(".dot.historical")
                    .style("opacity", nearestYear < 2015 ? 1 : 0);

                tooltip.html(text)
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY + 10) + "px")
                    .style("opacity", 0.9);
                
                hoverLine
                    .attr("x1", x(nearestYear))
                    .attr("x2", x(nearestYear))
                    .style("opacity", 1);
            })
            .on("mouseout", () => {
                tooltip.style("opacity", 0);
                hoverLine.style("opacity", 0);
            });

        // Checkbox listener
        d3.selectAll('#ssp-options input[type="checkbox"]').on('change', function () {
            const selectedScenarios = Array.from(document.querySelectorAll('#ssp-options input:checked'))
                .map(input => input.value);
            drawPredictionLines(selectedScenarios);
        });

    }).catch(err => console.error(err));
}

// Legend function
function drawLegend(svg, width, colorMap) {
    const legendData = [
        { name: "Historical", color: "black" },
        { name: "SSP1-2.6", color: "green" },
        { name: "SSP2-4.5", color: "blue" },
        { name: "SSP3-7.0", color: "orange" },
        { name: "SSP5-8.5", color: "red" },
    ];

    svg.selectAll(".legend").remove();

    const legend = svg.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${width + 10}, 10)`);

    legend.selectAll("rect")
        .data(legendData)
        .join("rect")
        .attr("x", 0)
        .attr("y", (d, i) => i * 20)
        .attr("width", 12)
        .attr("height", 12)
        .attr("fill", d => d.color);

    legend.selectAll("text")
        .data(legendData)
        .join("text")
        .attr("x", 18)
        .attr("y", (d, i) => i * 20 + 10)
        .text(d => d.name)
        .attr("font-size", "12px");
}


// Call the function
drawCO2LineChart(
    "linechart",
    "./data/co2mass_historical_1950_2014_yearly.csv",
    "./data/co2mass_ssp_predictions_yearly.csv"
);












//MAP INTERACTION

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
