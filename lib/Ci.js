// Javascript rewrite of
// http://statistics.berkeley.edu/~stark/Java/Html/Ci.htm
//
// Author: James Eady <jeady@berkeley.edu>
//
// container_id: the CSS ID of the container to create the histogram (and
//               controls) in.
// params: A javascript object with various parameters to customize the chart.
function Stici_Ci(container_id, params) {
    var self = this;

    // jQuery object containing the entire chart.
    var container = jQuery('#' + container_id);

    // These are constants.
    var maxSamples = 1000; // max number of samples
    var maxSampleSize = 250; // max sample size
    var nDigs = 4;  // number of digits in numbers in box
    var defaultPopSize = 10;
    var rSE = {
      "True SE": "true se",
      "Estimated SE": "estimated se",
      "Bound on SE (0-1 box only)": "bound on se (0-1 box only)"
    };
    var rSource = {
      "Normal": "normal",
      "Uniform": "uniform",
      "Box": "box",
      "0-1 Box": "0-1 box"
    };

    // User-configurable parameters. These are directly lifted from
    // Ci.java.
    var options = {
      factor: 1,
      showTruth: true,
      toggleSe: true,
      toggleTruth: true,
      editBox: true,
      replaceControl: false,
      replace: true,
      sampleSize: 2,
      sources: "all",
      seChoices: "all"
      //useSe: null,
      //boxContents,
    };
    jQuery.extend(options, params);

    // UI Elements.
    var sampleSizeBar = null;  // SticiTextBar
    var samplesToTakeBar = null;  // SticiTextBar
    var facBar = null;  // SticiTextBar
    var takeSampleButton = null;
    var hideBoxButton = null;  // SticiToggleButton
    var sourceChoice = null;  // SticiComboBox
    var seChoice = null;  // SticiComboBox
    var box = null;  // <textarea>
    var replaceCheck = null;  // SticiCheck
    var sourceLabel = null;
    var seLabel = null;
    var myCiPlot = new CiPlot();  // CiPlot
    var title = null;
    var lastItem = null;
    var lastSE = null;
    var useSe = null;
    var sampleSize = options.sampleSize;      // size of current sample
    var samplesToTake = 1;   // number of samples to take of that size
    var samplesSoFar = 0;    // number of samples taken so far
    var cover = null;        // number of intervals that cover
    var pop = null;        // elements of the population
    var nPop = 0;
    var sample = null;     // elements of the current sample
    var boxAve = null;       // the population mean
    var boxSd = null;        // the population SD
    var sampleMean = []; // the history of sample means
    var sampleSe = [];   // the history of sample SE(mean)'s
    var seUsed = [];     // vector of SE's to use for intervals
    var factor = options.factor;     // the blow-up factor for the intervals
    var showTruth = options.showTruth; // show the box contents and the true mean
    var toggleTruth = options.toggleTruth; // allow toggling hide/show
    var toggleSe = options.toggleSe;   // allow toggling true/sample SE
    var editBox = null;   // allow box contents to be edited
    var stats = null;
    var coverLabel = null;  // myLabel[0]
    var samplesLabel = null;  // myLabel[2]
    var aveLabel = null;  // myLabel[1]
    var sdLabel = null;  // myLabel[3]

    function init() {
      var o = jQuery('<div/>').addClass('stici stici_ci');
      container.append(o);

      // General pieces
      var top = jQuery('<div/>').addClass('top_controls');
      var middle = jQuery('<div/>').addClass('middle');
      var bottom = jQuery('<div/>').addClass('bottom_controls');
      o.append(top, middle, bottom);

      // Compose the top piece.
      top.append(createSelectDataSourceControls());

      // Compose the middle pieces.
      middle.append(createStatsBox(), myCiPlot, createPopulationBox());

      // Compose the bottom piece.
      bottom.append(createInfoRow());

      // Make sure everything is sized correctly.
      middle.height(container.height() - top.height() - bottom.height());
      myCiPlot.width(middle.width() - stats.width() - box.width() - 20);

      // Set all of the handlers.
      jQuery.each([hideBoxButton,
                   sampleSizeBar,
                   samplesToTakeBar,
                   facBar,
                   box,
                   seChoice,
                   sourceChoice,
                   replaceCheck],
                  function(_, e) {e.change(handleEvent);});
      takeSampleButton.click(handleEvent);

      // Below this point lie methods used to build the individual pieces.
      // Top.
      function createSelectDataSourceControls() {
        var dataSelectControls = jQuery('<div/>');
        var n;

        hideBoxButton = new SticiToggleButton({
          trueLabel: 'Hide Box',
          falseLabel: 'Show Box',
          value: true
        });

        var showSources = true;
        if (options.sources != "all") {
          n = 0;
          var oldRSource = rSource;
          rSource = {};
          jQuery.each(oldRSource, function(k, v) {
            if (options.sources.indexOf(k) >= 0 ||
                options.sources.indexOf(v) >= 0) {
              rSource[k] = v;
              n += 1;
            }
          });
          if (n <= 1)
            showSources = false;
        }
        sourceChoice = new SticiComboBox({
          label: "Sample from: ",
          options: rSource,
          selected: "Box"
        });
        if (showSources)
          dataSelectControls.append(sourceChoice);
        replaceCheck = new SticiCheck({
          label: ' with replacement',
          value: replaceCheck,
          readonly: !options.replaceControl
        });
        takeSampleButton = jQuery('<button id="takeSample"/>').text('Take Sample');
        dataSelectControls.append(takeSampleButton);
        dataSelectControls.append(replaceCheck);
        dataSelectControls.append(hideBoxButton);
        return dataSelectControls;
      }
      // Middle.
      function createPopulationBox() {
        var container = jQuery('<div/>').addClass('population');
        box = jQuery('<textarea/>');
        if (!options.editBox)
          box.attr("readonly", "readonly");
        container.append(box);
        return container;
      }
      function createStatsBox() {
        stats = jQuery('<div/>').addClass('statsText');

        aveLabel = jQuery('<p/>');
        samplesLabel = jQuery('<p/>');
        sdLabel = jQuery('<p/>');
        stats.append(samplesLabel, sdLabel, aveLabel);

        return stats;
      }
      // Bottom.
      function createInfoRow() {
        var row = jQuery('<div/>');

        if (options.seChoices != "all") {
          var oldRSE = rSE;
          rSE = {};
          jQuery.each(oldRSE, function(k, v) {
            if (options.seChoices.indexOf(k) >= 0 ||
                options.seChoices.indexOf(v) >= 0) {
              rSE[k] = v;
            }
          });
        }
        seChoice = new SticiComboBox({
          label: " * ",
          options: rSE
        });

        sampleSizeBar = jQuery('<input type="text"/>').val(sampleSize);
        samplesToTakeBar = jQuery('<input type="text"/>').val(samplesToTake);
        facBar = jQuery('<input type="text" id="bins" />').val(factor);
        coverLabel = jQuery('<p/>');
        row.append("Sample Size: ",
                   sampleSizeBar,
                   " Samples to take: ",
                   samplesToTakeBar,
                   " Intervals: +/- ",
                   facBar,
                   seChoice,
                   " ",
                   coverLabel);
        return row;
      }

      // The UI has been set up. Now initialize the data.
      var bc = "";
      if (options.boxContents !== null) {
        bc = options.boxContents;
      } else if (sourceChoice.selected() == "Normal") {
        bc = "Normal";
      } else if (sourceChoice.selected() == "Uniform") {
        bc = "Uniform";
      } else {
        bc = "0 1 2 3 4";
      }
      setBox(bc, true);
      if (!replaceCheck.checked()) {
        sampleSize = Math.min(sampleSize, nPop);
      }
      setSe();   // initialize the vector of SEs to use
      // set the labels
      aveLabel.text("#SEs:");
      if (showTruth) {
        coverLabel.text("0% cover");
        aveLabel.text("Ave(Box): " + boxAve.fix(2));
        sdLabel.text("SD(Box): " + boxSd.fix(2));
      } else {
        coverLabel.text(" ");
        aveLabel.text(" ");
        sdLabel.text(" ");
      }
      samplesLabel.text("Samples: " + samplesSoFar);
      samplesToTakeBar.val(samplesToTake );
      sampleSizeBar.val(sampleSize);
      facBar.val(factor);

      //myCiPlot = new CiPlot(boxAve, showTruth, null, seUsed, factor);
      showPlot(); // refresh the ciplot
    }

    function setSe() {
      var f = 1.0;
      var i;
      if (!replaceCheck.checked()) {
        f = Math.sqrt((nPop-sampleSize+0.0)/(nPop-1.0));
      }
      if (seChoice.selected() == "True SE") {
        if (sourceChoice.selected() == "Box" ||
            sourceChoice.selected() == "0-1 Box") {
          for (i = 0; i < samplesSoFar; i++) {
            seUsed[i] = f*boxSd/Math.sqrt(sampleSize + 0.0);
          }
        } else if (sourceChoice.selected() == "Normal") {
          for (i = 0; i < samplesSoFar; i++) {
            seUsed[i] = 1.0/Math.sqrt(sampleSize + 0.0);
          }
        } else if (sourceChoice.selected() == "Uniform") {
          for (i = 0; i < samplesSoFar; i++) {
            seUsed[i] = (1.0/12.0)/Math.sqrt(sampleSize + 0.0);
          }
        } else {
          System.out.println("Error in Ci.setSE(): unsupported source " + sourceChoice.selected());
        }
      } else if (seChoice.selected() == "Estimated SE") {
        for (i = 0; i < samplesSoFar; i++) {
          seUsed[i] = f*sampleSe[i];
        }
      } else if (seChoice.selected() == "Bound on SE (0-1 box only") {
        for (i = 0; i < samplesSoFar; i++) {
          seUsed[i] = f*0.5/Math.sqrt(sampleSize + 0.0);
        }
      } else {
        System.out.println("Error in Ci.setSE(): SE option not set!");
      }
      return;
    }

    function initPop() {
      var i;
      // compute population statistics
      if (sourceChoice.selected() == "Box" ||
          sourceChoice.selected() == "0-1 Box") {
        nPop = pop.length;
      boxAve = 0.0;
      boxSd = 0.0;
      for (i = 0; i < nPop; i++) {
        boxAve += pop[i];
      }
      boxAve /= nPop;
      for (i = 0; i < nPop; i++) {
        boxSd += (pop[i] - boxAve)*(pop[i] - boxAve);
      }
      boxSd = Math.sqrt(boxSd/nPop);
      } else if (sourceChoice.selected() == "Normal") {
        replaceCheck.checked(true);
        nPop = 0;
        boxAve = 0.0;
        boxSd = 1.0;
      } else if (sourceChoice.selected() == "Uniform") {
        replaceCheck.checked(true);
        nPop = 0;
        boxAve = 0.5;
        boxSd = Math.sqrt(1.0/12.0);
      }
      // reset the labels
      if (showTruth) {
        coverLabel.text("0% cover");
        aveLabel.text("Ave(Box): " + boxAve.fix(3));
        sdLabel.text("SD(Box): " + boxSd.fix(3));
      } else {
        coverLabel.text(" ");
        aveLabel.text(" ");
        sdLabel.text(" ");
      }
    }

    function handleEvent(e) {
      var i;
      if  (e.target == sampleSizeBar) { // clear history, reset sample size
        sampleSize = sampleSizeBar.val();
        if (!replaceCheck.checked()) {
          sampleSize = Math.min(sampleSize, nPop);
          sampleSizeBar.val(sampleSize);
        }
        refresh();
      } else if (e.target == facBar) {
        factor = facBar.val();
        setCover();
        showPlot();
      } else if (e.target == samplesToTakeBar) {
        samplesToTake = samplesToTakeBar.val();
      } else if (e.target == replaceCheck) {
        if (sourceChoice.selected() != "Box" &&
            sourceChoice.selected() != "0-1 Box") {
          replaceCheck.checked(true);
        } else {
          sampleSize = Math.min(sampleSize, nPop);
          sampleSizeBar.val(sampleSize);
        }
        refresh();
      } else if (e.target == sourceChoice) {
        var thisItem = sourceChoice.selected();
        if (thisItem != lastItem) {
          lastItem = thisItem;
          if ( sourceChoice.selected() == "Box" ) {
            if (lastSE == "Bound on SE (0-1 box only)") {
              lastSE = "Estimated SE";
              seChoice.select(lastSE);
            }
            setBox(box.text(),true);
          } else if (sourceChoice.selected() == "0-1 Box") {
            setBox(box.text(),true);
          } else {
            setBox(sourceChoice.selected());
          }
          showTruth = true;
          myButton[1].setLabel("Hide Box");
          showPlot();
        }
      } else if (e.target == seChoice) {
        var thisSE = seChoice.selected();
        if (thisSE != lastSE) {
          if (thisSE == "Bound on SE (0-1 box only)") {  // make sure this is a 0-1 box
            if (sourceChoice.selected() != "0-1 Box") {
              seChoice.select(lastSE);
            }
          }
          lastSE = thisSE;
          setSe();
          setCover();
          showPlot();
        }
      } else if (e.target == box) {
        setBox(box.text(),false);
        showPlot();
      } else if (e.target == takeSampleButton.get(0)) {
        var lim = maxSamples - samplesSoFar; // number possible
        for (i = 0; i < Math.min(samplesToTake, lim); i++) {
          xBar();
        }
        samplesLabel.text("Samples: " + samplesSoFar);
        if (showTruth) {
          coverLabel.text((cover/samplesSoFar).pct() + " cover");
        }
        showPlot();
      } else if (e.target == hideBoxButton) {
          showTruth = hideBoxButton.val();
          if (!showTruth) {
            box.text("Contents \n Hidden");
            randBox();
            samplesSoFar = 0;
            setCover();
            samplesLabel.text("Samples: " + samplesSoFar);
            showPlot();
          } else {
          var thePop = "";
          for (i = 0; i < nPop; i++) {
            thePop += pop[i].fix(nDigs) + "\n"; // print the population
          }
          setBox(thePop,true, false);
          setCover();
          showPlot();
        }
      }
    }

    function showPlot() {
      if (samplesSoFar > 0) {
        var sv = new Array(samplesSoFar);
        sv = sampleMean.slice(0, samplesSoFar);
        myCiPlot.redraw(boxAve, showTruth, sv, seUsed, factor);
      } else {
        myCiPlot.redraw(boxAve, showTruth, null, seUsed, factor);
      }
      return;
    }

    function setCover() {
      cover = 0;
      var wide = 0;
      for (var i = 0; i < samplesSoFar; i++) {
        wide = factor*seUsed[i];
        if (Math.abs(sampleMean[i] - boxAve) <= wide) cover++;
      }
      if (showTruth) {
        if (samplesSoFar > 0)
          coverLabel.text((cover/samplesSoFar).pct() + " cover");
        else coverLabel.text("0% cover");
      } else {
        coverLabel.text(" ");
      }
    }

    function randBox() {
      nPop = defaultPopSize;
      pop = Array(nPop);
      var i;
      if (sourceChoice.selected() != "0-1 Box") {
        var lim = 50*rand.next();
        var ctr = 25*rand.next();
        for (i = 0; i < nPop; i++) {
          pop[i] = lim*rand.next() - ctr;
        }
      } else {
        var ones = Math.floor(9*rand.next()+1);
        for (i = 0; i < ones; i++) {
          pop[i] = 1;
        }
        for (i = ones; i < nPop; i++) {
          pop[i] = 0;
        }
      }
      initPop();
    }

    function setBox(newBox, updateBox, reInit) { // parse new population
      newBox = newBox.replace(/^[,\n\t\r ]+|[,\n\t\r ]+$/g, '');
      var i;
      if (updateBox === undefined)
        updateBox = true;
      if (reInit === undefined)
        reInit = true;
      if (newBox.toLowerCase() == "normal") {
        replaceCheck.checked(true);
        pop = new Array(2);
        pop[0] = -4;
        pop[1] = 4;
        box.text("Normal");
        sourceChoice.select("Normal");
      } else if (newBox.toLowerCase() == "uniform") {
        replaceCheck.checked(true);
        pop = new Array(2);
        pop[0] = 0;
        pop[1] = 1;
        box.text("Uniform");
        sourceChoice.select("Uniform");
      } else {
        pop = newBox.split(/[,\n\t\r ]+/);
        pop = jQuery.map(pop, function(v) {return parseFloat(v);});
        var zeroOneOnly = true;
        if (sourceChoice.selected() == "0-1 Box") {
          for (i = 0; i < nPop; i++) {
            if ((pop[i] !== 0.0) && (pop[i] != 1.0)) {
              zeroOneOnly = false;
              if (Math.abs(pop[i]) <= 0.5) {
                pop[i] = 0;
              } else {
                pop[i] = 1;
              }
            }
          }
        }
        if (updateBox || (!zeroOneOnly && sourceChoice.selected() == "0-1 Box")) {
          if (showTruth) {
            box.text(jQuery.map(pop, function(e) {return e.fix(nDigs);}).join("\n"));
          } else {
            box.text("Contents Hidden");
          }
        }
      }
      if (reInit) {
        initPop();
        samplesSoFar = 0;
        setCover();
        samplesLabel.text("Samples: " + samplesSoFar);
      }
      if (!replaceCheck.checked()) {
        sampleSize = Math.min(sampleSize, nPop);
      }
    }  // ends setBox(String, boolean)

    function refresh() {
      samplesSoFar = 0;
      var sSd = boxSd/Math.sqrt(sampleSize);
      setCover();
      showPlot();
    }

    function xBar() {
      var xb = 0;
      var sse = 0;
      var x = new Array(sampleSize);
      var i;
      if (sourceChoice.selected() == "Box" ||
          sourceChoice.selected() == "0-1 Box") {
        if (replaceCheck.checked()) {
          for (i = 0; i < sampleSize; i++) {
            x[i] = pop[(rand.next()*nPop)];
            xb += x[i];
          }
        } else {
          var samInx = listOfDistinctRandInts(sampleSize, 0, nPop-1);
          for (i = 0; i < sampleSize; i++) {
            x[i] = pop[samInx[i]];
            xb += x[i];
          }
        }
      } else if (sourceChoice.selected() == "Uniform") {
        for (i = 0; i < sampleSize; i++) {
          x[i] = rand.next();
          xb += x[i];
        }
      } else if (sourceChoice.selected() == "Normal") {
        for (i = 0; i < sampleSize; i++) {
          x[i] = rNorm();
          xb += x[i];
        }
      }
      xb /= sampleSize;
      sse = sampleSd(x)/Math.sqrt(sampleSize);
      sampleMean[samplesSoFar] = xb;
      sampleSe[samplesSoFar] = sse;
      var f = 1.0;
      if (!replaceCheck.checked()) {
        f = Math.sqrt((nPop-sampleSize+0.0)/(nPop-1.0));
      }
      if (seChoice.selected() == "True SE") {
        seUsed[samplesSoFar++] = f*boxSd/Math.sqrt(sampleSize);
      } else if (seChoice.selected() == "Bound on SE (0-1 box only") {
        seUsed[samplesSoFar++] = f*0.5/Math.sqrt(sampleSize);
      } else {
        seUsed[samplesSoFar++] = f*sse;
      }
      if (Math.abs(xb - boxAve) <= factor*seUsed[samplesSoFar - 1]) {
        cover++;
      }
    }

    init();

    function CiPlot() {
      var self = this;
      self = jQuery('<div/>').addClass('stici_ciplot stici_chartbox');

      self.redraw = function(truth, showTruth, center, se, factor) {
        self.children().remove();

        var height = self.height() - 20;
        var width = self.width();
        var yScale = 0;
        var x_min = -0.1;
        var x_max = 1;
        if (center !== null && center !== undefined) {
          x_min = center.min();
          x_max = center.max();
          yScale = height / center.length;

          jQuery.each(center, function(i, c) {
            x_min = Math.min(x_min, c - factor * se[i]);
            x_max = Math.max(x_max, c + factor * se[i]);
          });
        }
        if (showTruth) {
          x_min = Math.min(x_min, truth);
          x_max = Math.max(x_max, truth);
        }

        // Draw the axis.
        var scale =
          d3.scale.linear()
            .domain([x_min, x_max])
            .range([0, width]);
        d3.select(self.get(0))
          .append('svg')
          .attr('class', 'axis')
          .append('g').call(d3.svg.axis().scale(scale).orient('bottom'));

        if (center === null)
          return;

        // Draw the box.
        d3.select(self.get(0))
          .append('svg')
          .selectAll('div')
          .data(center)
          .enter()
          .append('rect')
          .attr('y', function(d, i) { return height - i * yScale - 4; })
          .attr('height', 4)
          .attr('x', function(d, i) {
            return (d - x_min - se[i] * factor) / (x_max - x_min) * width;
          })
          .attr('width', function(d, i) {
            return (se[i] * factor * 2) / (x_max - x_min) * width;
          })
          .attr('class', function(d, i) {
            var lo = d - factor * se[i];
            var hi = d + factor * se[i];
            if (truth >= lo && truth <= hi)
              return 'inner';
            else
              return 'outer';
          });

        // Draw the tick in the center.
        d3.select(self.get(0))
          .append('svg')
          .selectAll('div')
          .data(center)
          .enter()
          .append('rect')
          .attr('y', function(d, i) { return height - i * yScale - 4; })
          .attr('height', 4)
          .attr('x', function(d) {
            return (d - x_min) / (x_max - x_min) * width - 2;
          })
          .attr('width', 5);

        // Draw the truth line.
        if (showTruth) {
          var line =
            d3.svg.line()
              .x(function(d) {
                return (d - x_min) / (x_max - x_min) * width;
              })
              .y(function(d, i) {
                if (i === 0)
                  return 0;
                else
                  return height;
              });
          d3.select(self.get(0))
            .append('svg')
            .attr('class', 'truth')
            .append('path')
            .data([[truth, truth]])
            .attr('d', line);
        }
      };

      return self;
    }
}
