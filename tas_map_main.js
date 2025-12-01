document.addEventListener("DOMContentLoaded", () => {
  const stripesCsv = "./data/global_temp_anomaly_1950_2050.csv";
  const countryCsv = "./data/country_temp_anomaly_1950_2050.csv";
  const worldGeoJsonPath = "world.geojson";

  const stripeMargin = { top: 10, right: 10, bottom: 20, left: 10 };
  const stripeWidth = 900;
  const stripeHeight = 80;

  const mapWidth = 900;
  const mapHeight = 460;

  const noDataColor = "#444";

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
      .unknown("#222");


    // color scale for map
    const mapAnoms = countryData.map(d => d.anomaly);
    const mapLo = d3.quantile(mapAnoms, 0.02);
    const mapHi = d3.quantile(mapAnoms, 0.98);

    mapColorScale = d3.scaleDiverging()
      .domain([mapHi, 0, mapLo])
      .interpolator(d3.interpolateRdBu)
      .clamp(true)
      .unknown("#222");

    drawStripes();
    drawMapBase();

    const defaultYear =
      stripesData.find(d => !d.is_future)?.year ||
      stripesData[Math.floor(stripesData.length / 2)].year;

    setSelectedYear(defaultYear);
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
      });


      const xAxis = gAxis => gAxis
      .attr("transform", `translate(0,${stripeHeight - stripeMargin.bottom})`)
      .call(
        d3.axisBottom(stripeXScale)
          .tickValues(years.filter(y => y % 10 === 0))
          .tickSize(3)
      )
      .call(g => g.selectAll("text")
        .attr("fill", "#ddd")
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
        .attr("stroke", "#f5f5f5")
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
      .attr("fill", "#111");

    mapSvg.append("g")
      .attr("class", "countries")
      .selectAll("path")
      .data(worldFeatures)
      .enter()
      .append("path")
      .attr("class", "country")
      .attr("d", path)
      .attr("fill", noDataColor)
      .attr("stroke", "#555")
      .attr("stroke-width", 0.5)
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
      .duration(400)
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
});
