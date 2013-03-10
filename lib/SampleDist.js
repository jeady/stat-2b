function Stici_SampleDist(container_id, params) {
    var self = this;

    // jQuery object containing the entire chart.
    var container = jQuery('#' + container_id);

    // These are constants.
    var maxBins = 100;
    var nDigs = 4;
    var maxSamples = 10000;
    var maxMaxSampleSize = 500;  // max size of each sample
    var curveLabel = {
      "No Curve": "none",
      "Normal Curve": "normal",
      "Student t Curve": "t",
      "Chi-Squared Curve": "chi-squared"
    };
    var rVar = {  // random variable options and their abbreviations
      "Sample Sum": "sum",
      "Sample Mean": "mean",
      "Sample t": "t",
      "Sample S-Squared": "s-squared",
      "Sample Chi-Squared": "chi-squared"
    };
    var rSource = {
      "Normal": "normal",
      "Uniform": "uniform",
      "Box": "box"
    };

    // User-configurable parameters. These are directly lifted from
    // SampleDist.java. I don't know what the commented ones are yet, nor what
    // their default values should be. -jeady
    var options = {
        binControls: true,
        bins: maxBins,
        boxContents: "0,1,2,3,4",
        boxEditable: true,
        boxHistControl: false,
        curveControls: true,
        curves: "all",
        hiLiteHi: 0.0,
        hiLiteLo: 0.0,
        replace: true,
        replaceControl: false,
        sampleSize: 5,
        samplesToTake: 1,
        showBoxHist: true,
        showCurve: false,
        sources: "all",
        startWith: "sum",
        statLabels: true,
        toggleVar: true,
        variables: "all"
    };
    jQuery.extend(options, params);

    // UI Elements.
    // Most of these are actually initialized later in init(), but they're
    // here temporarily to conform with the existing java code.
    var takeSampleButton = null; // SticiToggleButton, myButton[0] in the Java.
    var populationButton = null; // SticiToggleButton, myButton[1] in the Java.
    var sampleSizeBar = null;    // <input/> //size of each sample
    var samplesToTakeBar = null; // <input/> //number of samples to take
    var binBar = null;           // <input/> //number of bins in the histogram
    var lo = null;  // SticiTextBar
    var hi = null;  // SticiTextBar
    var box = null;  // textarea                  // holds the population.
    var popMeanLabel = null;                      // to display the population mean
    var popSdLabel = null;                        // to display the population SD
    var statSampleMeanLabel = null;               // to display mean of sample means
    var statSampleSDLabel = null;                 // sample SD of sample means
    var statExpLabel = null;                      // theor. Expected value of statistic
    var statSELabel = null;                       // to display theor. SD of statistic or d.f. of chi-square
    var samplesSoFarLabel = null;                 // number of samples of current size taken
    var boxLabel = null;                          // label box as population or category probabilities
    var areaLabel = null;  // span
    var curveAreaLabel = null;  // span
    var hist = new SticiHistogram();
    var replaceCheck = null;
    var varChoice = null;  // SticiComboBox       // options for which random variable to sample
    var curveChoice = null;  // SticiComboBox     // options for which approximating curve to plot
    var sourceChoice = null;  // SticiComboBox    // options for data source (box, normal, uniform)
    var stats = null;                             // Contains all of the statistics labels.

    // State variables.
    var pop = [];                               // elements of the population
    var sample = [];                            // elements of the current sample
    var xMin = null;
    var xMax = null;
    var samplesSoFar = 0;
    var sampleMean = [];                        // the history of sample means
    var sampleSSq = [];                         // history of sample s^2
    var sampleT = [];                           // history of sample t
    var sampleSize = options.sampleSize;        // size of current sample
    var samplesToTake = options.samplesToTake;  // number of samples to take of that size
    var binEnd = [];                            // bin endpoints
    var countPop = [];                          // areas of the bins for the pop. histogram
    var countSample = [];                       // areas of bins for the hist. of sample means
    var hiLiteLo = options.hiLiteLo;
    var hiLiteHi = options.hiLiteHi;
    var showBoxHist = options.showBoxHist;
    var nBins = options.bins;
    var minSampleSize;              // minimum sample size (2 for vars that use ssd)
    var maxSampleSize;              // maximum sample size (population size if sampling w/o replacement)
    var currVar = null;
    var lastVar = null;
    var EX = 0;                         // expected value of the variable plotted
    var SE = 0;                         // standard error of the variable plotted
    var popMin = 0;                     // smallest value in pop.
    var popMax = 0;                     // largest value in pop.
    var popMean = 0;                    // the population mean
    var popSd = 0;                      // the population SD

    function init() {
      var o = jQuery('<div/>').addClass('stici stici_sampledist');
      container.append(o);

      // General pieces
      var top = jQuery('<div/>').addClass('top_controls');
      var middle = jQuery('<div/>').addClass('middle');
      var bottom = jQuery('<div/>').addClass('bottom_controls');
      o.append(top, middle, bottom);

      // Compose the top piece.
      top.append(createSelectDataSourceControls());

      // Compose the middle pieces.
      middle.append(createStatsBox(), hist, createPopulationBox());

      // Compose the bottom piece.
      if (showBoxHist) {
        bottom.append(createSampleRow(),
                      createAreaSelectRow(),
                      createInfoRow());
      } else {
        createSampleRow();
        createAreaSelectRow();
        createInfoRow();
      }

      // Make sure everything is sized correctly.
      middle.height(container.height() - top.height() - bottom.height());
      hist.width(middle.width() - stats.width() - box.width() - 20);

      // Set all of the handlers.
      jQuery.each([populationButton,
                   sampleSizeBar,
                   samplesToTakeBar,
                   binBar,
                   lo,
                   hi,
                   box,
                   varChoice,
                   curveChoice,
                   sourceChoice,
                   replaceCheck],
                  function(_, e) {e.change(handleEvent);});
      takeSampleButton.click(handleEvent);

      // Below this point lie methods used to build the individual pieces.
      // Top.
      function createSelectDataSourceControls() {
        var dataSelectControls = jQuery('<div/>');
        varChoice = new SticiComboBox({
          label: "Distribution of: ",
          options: rVar,
          selected: options.startWith
        });
        currVar = varChoice.selected();
        sourceChoice = new SticiComboBox({
          label: "Sample from: ",
          options: rSource,
          selected: "Box"
        });
        dataSelectControls.append(varChoice, sourceChoice);
        replaceCheck = jQuery('<input type="checkbox"/>');
        if (options.replaceControl)
          dataSelectControls.append(replaceCheck, ' with replacement');
        takeSampleButton = jQuery('<button id="takeSample"/>').text('Take Sample');
        dataSelectControls.append(takeSampleButton);
        return dataSelectControls;
      }
      // Middle.
      function createPopulationBox() {
        var container = jQuery('<div/>').addClass('population');
        boxLabel = jQuery('<div/>');
        box = jQuery('<textarea/>');
        if (!options.boxEditable)
          box.attr("readonly", "readonly");
        container.append(boxLabel, box);
        return container;
      }
      function createStatsBox() {
        stats = jQuery('<div/>').addClass('statsText');
        popMeanLabel = jQuery('<p/>');
        popSdLabel = jQuery('<p/>');
        statExpLabel = jQuery('<p/>');
        statSELabel = jQuery('<p/>');
        stats.append(popMeanLabel,
                        popSdLabel,
                        statExpLabel,
                        statSELabel);
        if (options.statLabels) {
          statSampleMeanLabel = jQuery('<p/>');
          statSampleSDLabel = jQuery('<p/>');
          stats.append(statSampleMeanLabel,
                          statSampleSDLabel);
        }
        samplesSoFarLabel = jQuery('<p/>');
        stats.append(samplesSoFarLabel);

        return stats;
      }
      // Bottom.
      function createSampleRow() {
          var row = jQuery('<div/>');

          areaLabel = jQuery('<span/>');
          curveAreaLabel = jQuery('<span/>');
          if (options.curves != "all") {
            var oldLabels = curveLabel;
            curveLabel = {};
            jQuery.each(oldLabels, function(k, v) {
              if (options.curves.indexOf(k) >= 0 ||
                  options.curves.indexOf(v) >= 0)
                curveLabel[k] = v;
            });
          }
          curveChoice = new SticiComboBox({
            label: '',
            options: curveLabel
          });
          populationButton = SticiToggleButton({
            trueLabel: 'No Population Histogram',
            falseLabel: 'Population Histogram',
            value: true
          });

        if (showBoxHist) {
          row.append(areaLabel);
          if (options.curveControls)
            row.append(curveAreaLabel, curveChoice);
          if (options.boxHistControl)
            row.append(populationButton);
        }
        return row;
      }
      function createAreaSelectRow() {
        var row = jQuery('<div/>').addClass('areaHiLite');
        lo = new SticiTextBar({
          step: 0.001,
          value: hiLiteLo,
          min: -10000,
          max:  10000,
          label: 'Area from: '
        });
        hi = new SticiTextBar({
          step: 0.001,
          value: hiLiteHi,
          min: -10000,
          max:  10000,
          label: ' to: '
        });
        row.append(lo, hi);
        return row;
      }
      function createInfoRow() {
        var row = jQuery('<div/>');

        sampleSizeBar = jQuery('<input type="text"/>').val(sampleSize);
        samplesToTakeBar = jQuery('<input type="text"/>').val(samplesToTake);
        row.append("Sample Size: ",
                   sampleSizeBar,
                   " Take ",
                   samplesToTakeBar,
                   " samples. ");
        binBar = jQuery('<input type="text" id="bins" />').val(options.bins);
        if (options.binControls) {
          row.append(" Bins: ", binBar);
        }
        return row;
      }


      // The UI has been set up. Now initialize the data.
      if (options.sources === null ||
          options.sources.toLowerCase().indexOf("box") >= 0 ||
            options.sources.toLowerCase().indexOf("all") >= 0) {
        if (varChoice.selected() == "Sample Chi-Squared")
          boxLabel.text("Category Probabilities");
        else
          boxLabel.text("Population");
      }
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
      var vmx = vMinMax(pop);
      xMin = vmx[0];
      xMax = vmx[1];
      initPop();
      setCurve();                                   // set the approximating curve
      setBins();                                    // make the histogram counts
      setBars(options.hiLiteLo, options.hiLiteHi);
      replaceCheck.attr('checked', options.replace);
      adjustSampleSize();
      showPlot();                                   // refresh the histogram
    }

    // compute population statistics
    function initPop() {
      if (sourceChoice.selected() == "Box") {
        popMean = 0;
        popSd = 0;
        if (pop.length === 0) {
          console.log("Error in SampleDist.initPop(): Population is empty!\n");
          for (var i= 0; i < nBins; i++) {
            countPop[i] = 0;
          }
          // TODO(jmeady): Do we need to clear anything out here?
          return;
        }
        popMean = mean(pop);
        popSd = sd(pop);
        // FIX ME! need to handle probabilities here.
      } else if (sourceChoice.selected() == "Normal") {
        popMean = 0;
        popSd = 1;
        replaceCheck.attr('checked', true);
      } else if (sourceChoice.selected() == "Uniform") {
        popMean = 0.5;
        popSd = Math.sqrt(1.0/12.0);
        replaceCheck.attr('checked', true);
      }
      popMin = pop.min();
      popMax = pop.max();
      setLims();                                  // set plot limits
      // make the histogram of the population
      setBins();                                    // set the class intervals; make the counts
      setBars(xMin,xMin);                           // set the hilight scrollbar scales
      // reset the labels
      if (varChoice.selected() == "Sample Chi-Squared") {
        popMeanLabel.text("Categories: " + pop.length);
        popSdLabel.text("E(Chi-Squared): " + (pop.length-1));
        replaceCheck.attr('checked', true);
      } else {
        popMeanLabel.text("Ave(Box): " + popMean.fix(3));
        popSdLabel.text("SD(Box): " + popSd.fix(3));
        statSampleMeanLabel.text("Mean(values): undefined");
        statSampleSDLabel.text("SD(values): undefined");
      }
      setCurve();
      setCurveLabel();
      setAreas();
    }

    function handleEvent(e) {
      if (binBar.is(e.target)) {                   // update # bins and redraw histogram
        nBins = parseInt(binBar.val(), 10);
        setBins();                              // reset the class intervals, make the counts
        showPlot();                             // refresh the histogram
      } else if (sampleSizeBar.is(e.target)) {     // clear history, reset sample size, redisplay histogram
        sampleSize = parseInt(sampleSizeBar.val(), 10);
        setBars(xMin, xMin);
        samplesSoFar = 0;
        setSamLabel();
        setLims();
        setCurveLabel();
        setBins();
        setCurve();
        setAreas();
        showPlot();
      } else if (samplesToTakeBar.is(e.target)) {
        samplesToTake = parseInt(samplesToTakeBar.val(), 10);
      } else if (lo.is(e.target) || hi.is(e.target)) {
        hiLiteLo = lo.val();
        hiLiteHi = hi.val();
        if (hiLiteLo >= hiLiteHi) hiLiteLo = hiLiteHi;
        setAreas();
        showPlot();
      } else if(box.is(e.target)) {
        setBox(box.val());
      } else if (takeSampleButton.is(e.target)) {
        var lim = maxSamples - samplesSoFar;            // number remaining samples
        drawSample(Math.min(samplesToTake, lim));
        setSamLabel();
      } else if (sourceChoice.is(e.target)) {
        if (sourceChoice.selected() == "Box" ) {
          setBox(box.val());
        } else {
          setBox(sourceChoice.selected());
          replaceCheck.attr('checked', true);
        }
      } else if (varChoice.is(e.target)) {
        lastVar = currVar;
        currVar = varChoice.selected();
        newVariable(varChoice.selected());
        showPlot();
      } else if (curveChoice.is(e.target)) {
        setCurve();
        setAreas();
        showPlot();
      } else if (replaceCheck.is(e.target)) {
        if (replaceOK(replaceCheck.is(':checked'))) {
          samplesSoFar = 0;
          setLims();
          setBins();
          setSamLabel();
          setBins();
          setBars(hiLiteLo, hiLiteHi);
          setCurveLabel();
          setCurve();
          setAreas();
        } else {
          replaceCheck.attr('checked', true);
        }
      } else if (populationButton.is(e.target)) {
        showBoxHist = populationButton.val();
        setLims();
        setBins();
        setBars(hiLiteLo, hiLiteHi);
        setCurve();
        showPlot();
      } else {
        console.log("Handling unknown event for " + e.target);
      }
    }

    function replaceOK(rep) {
      var v = true;
      if (!rep) {
        if (sourceChoice.selected() != "Box") {
          v = false;
        } else {
          var s = varChoice.selected();
          if (!(s == "Sample Sum" ||
                s == "Sample Mean" ||
                s == "Sample S-Squared" ||
                  s == "Sample t"))
            v = false;
        }
      }
      return v;
    }

    // test what is to be plotted; adjust variables accordingly
    function showPlot() {
      var curves = hist.curves();
      if (samplesSoFar > 0) {
        if (showBoxHist)
          hist.set(binEnd, [countPop, countSample], curves);
        else
          hist.set(binEnd, [[], countSample], curves);
      } else {
        if (showBoxHist)
          hist.set(binEnd, [countPop, []], curves);
        else
          hist.set(binEnd, [[], countSample], curves);
      }
      hist.hilite(hiLiteLo, hiLiteHi);
    }

    // set things up when the variable is changed
    function newVariable() {     // set things up when the variable is changed
      if ((varChoice.selected() == "Sample S-Squared" ||
           varChoice.selected() == "Sample t") &&
          (sampleSize == 1) ) {
            samplesSoFar = 0;
          }
          adjustSampleSize();
          if (lastVar == "Sample Chi-Squared" ||
              varChoice.selected() == "Sample Chi-Squared") {
            samplesSoFar = 0;
          }
          if (varChoice.selected() == "Sample Chi-Squared") {
            boxLabel.text("Category Probabilities");
            setBox(box.val(),true);
          } else {
            boxLabel.text("Population");
          }
          if (!(varChoice.selected() == "Sample Mean" ||
                varChoice.selected() == "Sample Sum" ||
                varChoice.selected() == "Sample S-Squared") ||
                varChoice.selected() == "Sample t") {
            replaceCheck.attr('checked', true);
          }
          setSamLabel();
          setLims();
          setBins();
          setBars(hiLiteLo, hiLiteHi);
          setCurveLabel();
          setCurve();
          setAreas();
    } // ends newVariable

    // function population
    function setBox(newBox, updateBox) {               // parse new population
      if (updateBox === undefined)
        updateBox = false;

      newBox = newBox.replace(/^[,\n\t\r ]+|[,\n\t\r ]+$/g, '');

      if (newBox.toLowerCase() == "normal") {
        replaceCheck.attr('checked', true);
        pop = [-4, 4];
        box.val("Normal");
        sourceChoice.selected("Normal");
        if (varChoice.selected() == "Sample Chi-Squared") {
          console.log("Warning in SampleDist.setBox(): normal incompatible " +
                             "with Sample Chi-Squared");
          varChoice.selected("Sample Mean");
        }
      } else if (newBox.toLowerCase() == "uniform") {
        replaceCheck.attr('checked', true);
        pop = [0, 1];
        box.val("Uniform");
        sourceChoice.selected("Uniform");
        if (varChoice.selected() == "Sample Chi-Squared") {
          console.log("Warning in SampleDist.setBox(): uniform incompatible " +
                             "with Sample Chi-Squared");
          varChoice.select("Sample Mean");
        }
      } else {
        pop = newBox.split(/[,\n\t\r ]+/);
        pop = jQuery.map(pop, function(v) {return parseFloat(v);});
        if (varChoice.selected() == "Sample Chi-Squared") {
          pop = jQuery.grep(pop, function(v) {
            return (v !== 0 && !isNaN(v));
          });
          pop = scalVMult(1.0/vSum(pop), pop);
          updateBox = true;
        }
        if (updateBox) {
          box.val(jQuery.map(pop, function(v) {return v.fix(nDigs);}).join("\r"));
        }
        sourceChoice.selected("Box");
      }
      initPop();
      samplesSoFar = 0;
      setSamLabel();
    }  // ends setBox(String, boolean)

    function setSamLabel() {
      samplesSoFarLabel.text("Samples: " + samplesSoFar);
      if (varChoice.selected() == "Sample Mean") {
        countSample = listToHist(sampleMean, binEnd, nBins, samplesSoFar);
        statSampleMeanLabel.text(
          "Mean(values): " + mean(sampleMean, samplesSoFar).fix(nDigs));
        statSampleSDLabel.text(
          "SD(values): " + sd(sampleMean, samplesSoFar).fix(nDigs));
      } else if (varChoice.selected() == "Sample Sum") {
        countSample = listToHist(scalVMult(sampleSize, sampleMean), binEnd, nBins, samplesSoFar);
        statSampleMeanLabel.text(
          "Mean(values): " + (sampleSize * mean(sampleMean, samplesSoFar)).fix(nDigs));
        statSampleSDLabel.text(
          "SD(values): " + (sampleSize * sd(sampleMean, samplesSoFar)).fix(nDigs));
      } else if (varChoice.selected() == "Sample t") {
        countSample = listToHist(sampleT, binEnd, nBins, samplesSoFar);
        statSampleMeanLabel.text(
          "Mean(values): " + mean(sampleT, samplesSoFar).fix(nDigs));
        statSampleSDLabel.text(
          "SD(values): " + sd(sampleT, samplesSoFar).fix(nDigs));
      } else if (varChoice.selected() == "Sample S-Squared" ||
                 varChoice.selected() == "Sample Chi-Squared") {
        countSample = listToHist(sampleSSq, binEnd, nBins, samplesSoFar);
        statSampleMeanLabel.text(
          "Mean(values): " + mean(sampleSSq, samplesSoFar).fix(nDigs));
        statSampleSDLabel.text(
          "SD(values): " + sd(sampleSSq, samplesSoFar).fix(nDigs));
      }
      setAreas();
      showPlot();
    }

    function setAreas() {
      areaLabel.text(" Selected area: " + hiLitArea().pct());
      if (curveChoice.selected() == "Normal Curve")
        curveAreaLabel.text(" Normal approx: " + normHiLitArea().pct());
      else if (curveChoice.selected() == "Student t Curve")
        curveAreaLabel.text(" Student t approx: " + tHiLitArea().pct());
      else if (curveChoice.selected() == "Chi-Squared Curve")
        curveAreaLabel.text(" Chi-squared approx: " + chiHiLitArea().pct());
      else
        curveAreaLabel.text("");
    } // ends setAreas()

    function setCurveLabel() {
      var fpc = 1.0;
      if (!replaceCheck.is(':checked')) {
        fpc = Math.sqrt( (pop.length - sampleSize + 0.0)/(pop.length-1.0));
      }
      if (varChoice.selected() == "Sample Sum") {
        SE = fpc*popSd*Math.sqrt(sampleSize + 0.0);
        EX = sampleSize*popMean;
        statExpLabel.text("E(sum): " + EX.fix(3)  + "  ");
        statSELabel.text("SE(sum): " + SE.fix(3)  + "  ");
      } else if (varChoice.selected() == "Sample Mean") {
        SE = fpc*popSd/Math.sqrt(sampleSize + 0.0);
        EX = popMean;
        statExpLabel.text("E(mean): " + EX.fix(4)  + "  ");
        statSELabel.text("SE(mean): " + SE.fix(4) + "  ");
      } else if (varChoice.selected() == "Sample t") {
        if ( sampleSize > 2 ) {
          SE = Math.sqrt((sampleSize + 0.0)/(sampleSize - 2.0));
        } else {
          SE = Double.NaN;
        }
        EX = popMean;
        statExpLabel.text("E(t): " + EX.fix(4)  + "  ");
        statSELabel.text("SE(t): " + SE.fix(4) + "  ");
      } else if (varChoice.selected() == "Sample S-Squared") {
        if (replaceCheck.is(':checked')) {
          EX = popSd*popSd;
        } else {
          EX = popSd*popSd*pop.length/(pop.length-1.0);
        }
        SE = Math.sqrt(2.0/(sampleSize-1.0))*popSd*popSd;
        statExpLabel.text("E(S-squared): " + EX.fix(3)  + "  ");
        statSELabel.text("df: " +  (sampleSize-1) + "  ");
      } else if (varChoice.selected() == "Sample Chi-Squared") {
        EX = pop.length - 1;
        SE = Math.sqrt(2.0*(pop.length-1.0));
        popMeanLabel.text("Categories: " + pop.length);
        popSdLabel.text("E(Chi-Squared): " + (pop.length - 1));
        statExpLabel.text("df: " + (pop.length - 1) + " ");
        statSELabel.text("      ");
      }
    } // ends setCurveLabel()

    function drawSample(nSams) {
      var theSample = new Array(sampleSize);
      var indices = new Array(sampleSize);
      var xb;
      var ssq;
      var tStat;
      var tmp;
      var i;
      for (var j=0; j < nSams; j++) {
        xb = 0;
        ssq = 0;
        tStat = 0;
        if ( varChoice.selected() == "Sample Chi-Squared")  {
          if (sourceChoice.selected() == "Box") {
            var cum = vCumSum(pop);     // cum expecting an Array
            var count = new Array(pop.length); // count expecting an Array
            for (i=0; i < pop.length; i++) {
              count[i] = 0.0;
            }
            for (i=0; i < sampleSize; i++) {
              tmp = rand.next();
              if (tmp <= cum[0]) {
                count[0]++;
              }
              for (var k=1; k < count.length; k++) {
                if ( tmp > cum[k-1] && tmp <= cum[k] ) {
                  count[k]++;
                }
              }
            }
            ssq = 0.0;
            for (i=0; i < pop.length; i++) {
              tmp = sampleSize*pop[i];
              ssq += (count[i] - tmp)*(count[i] - tmp)/tmp;
            }
            sampleSSq[samplesSoFar++] = ssq;                                    // FIX: aculich 2013-03-06
            if (ssq < xMin || ssq > xMax) {
              xMin = Math.min(ssq, xMin);
              xMax = Math.max(ssq, xMax);
            }
          } else {
            console.error("Error in SampleDist.drawSample(): cannot draw from " +
                          "this distribution with Sample Chi-Square!");
          }
        } else {
          if (sourceChoice.selected() == "Box") {
            if (replaceCheck.is(':checked')) {
              indices = listOfRandInts(sampleSize, 0, pop.length-1);
            } else {
              indices = listOfDistinctRandInts(sampleSize, 0, pop.length-1);
            }
            for (i = 0; i < sampleSize; i++) {
              theSample[i] = pop[ indices[i] ];
              xb += theSample[i];
            }
          } else if (sourceChoice.selected() == "Normal") {
            for (i = 0; i < sampleSize; i++) {
              theSample[i] = rNorm();
              xb += theSample[i];
            }
          } else if (sourceChoice.selected() == "Uniform") {
            for (i = 0; i < sampleSize; i++) {
              theSample[i] = rand.next();
              xb += theSample[i];
            }
          }
          xb /= sampleSize;
          for (i = 0; i < sampleSize; i++) {
            ssq += (theSample[i] - xb)*(theSample[i] - xb);
          }
          if (sampleSize > 1) {                             // if n>1, log the sample s^2 and t
            ssq /= (sampleSize-1);
            sampleSSq[samplesSoFar] = ssq;
            tStat = xb/(Math.sqrt(ssq)/Math.sqrt(sampleSize));
            sampleT[samplesSoFar] = tStat;
          } else {                                          // otherwise, set to 0.
            sampleSSq[samplesSoFar] = 0;
            sampleT[samplesSoFar] = 0;
          }
          sampleMean[samplesSoFar++] = xb;                  // log the sample mean        // FIX: aculich 2013-03-06
          if (varChoice.selected() == "Sample Mean") {
            if (xb < xMin || xb > xMax) {
              xMin = Math.min(xb, xMin);
              xMax = Math.max(xb, xMax);
            }
          } else if (varChoice.selected() == "Sample t") {
            if (tStat < xMin || tStat > xMax) {
              xMin = Math.min(tStat, xMin);
              xMax = Math.max(tStat, xMax);
            }
          } else if ( varChoice.selected() == "Sample Sum") {
            tmp = xb * sampleSize;
            if (tmp < xMin || tmp > xMax) {
              xMin = Math.min(tmp, xMin);
              xMax = Math.max(tmp, xMax);
            }
          } else if (varChoice.selected() == "Sample S-Squared") {
            if (ssq < xMin || ssq > xMax) {
              xMin = Math.min(ssq, xMin);
              xMax = Math.max(ssq, xMax);
            }
          }
        }
      }
      setBins();
      setBars(hiLiteLo, hiLiteHi);
    }

    // set the TextBars for hilight and sampleSize
    function setBars(l, h) {
        hi.set(h, xMin, xMax, Math.pow(10, -1 * nDigs));
        lo.set(l, xMin, xMax, Math.pow(10, -1 * nDigs));
        hiLiteLo = l;
        hiLiteHi = h;
        adjustSampleSize();
    }

    function setBins() {
      binEnd = [];
      jQuery.each(range(0, nBins + 1), function(i) {
          binEnd[i] = xMin + i*(xMax - xMin)/nBins;
      });
      countPop = new Array(nBins);
      countSample = new Array(nBins);
      if (sourceChoice.selected() == "Box" && pop.length > 0) {
        if (varChoice.selected() == "Sample Chi-Squared") {
          setCurve();
        } else {
          countPop = listToHist(pop, binEnd, nBins);
          setCurve();
        }
      } else if (sourceChoice.selected() == "Normal") {
        jQuery.each(range(0, nBins), function(i) {
          countPop[i] = (normCdf(binEnd[i+1]) -
                         normCdf(binEnd[i]))/(binEnd[i+1] - binEnd[i]);
        });
      } else if (sourceChoice.selected() == "Uniform") {
        var midPt;
        jQuery.each(range(0, nBins), function(i) {
          midPt = (binEnd[i]+binEnd[i+1])/2;
          if (midPt >= 0 && midPt <= 1) {
            countPop[i] = 1;
          } else {
            countPop[i] = 0;
          }
        });
      }
      if (samplesSoFar > 0 ) {
        if (varChoice.selected() == "Sample S-Squared" || varChoice.selected() == "Sample Chi-Squared") {
          countSample = listToHist(sampleSSq, binEnd, nBins, samplesSoFar);
        } else if (varChoice.selected() == "Sample Mean") {
          countSample = listToHist(sampleMean, binEnd, nBins, samplesSoFar);
        } else if (varChoice.selected() == "Sample t") {
          countSample = listToHist(sampleT, binEnd, nBins, samplesSoFar);
        } else if (varChoice.selected() == "Sample Sum") {
          countSample = listToHist(scalVMult(sampleSize, sampleMean), binEnd, nBins, samplesSoFar);
        }
      } else {
        jQuery.each(range(0, nBins), function(i) {
          countSample[i] = 0;
        });
      }
    }

    function setLims() {
        if (varChoice.selected() == "Sample Sum") {
            xMin = sampleSize * popMin; // these are the limits for the histogram
            xMax = sampleSize * popMax;
        } else if (varChoice.selected() == "Sample Chi-Squared") {
            xMin = 0.0;
            xMax = 10*Math.sqrt(pop.length - 1); // 5 SD
        } else if (varChoice.selected() == "Sample S-Squared") {
            xMin = 0.0;
            var maxDev = Math.max(popMean-popMin, popMax-popMean);
            xMax = 3*maxDev*maxDev/Math.sqrt(sampleSize);
        } else if (varChoice.selected() == "Sample Mean") {
            xMin = popMean-4*popSd/Math.sqrt(sampleSize);
            xMax = popMax+4*popSd/Math.sqrt(sampleSize);
        } else if (varChoice.selected() == "Sample t") {
            if (sampleSize > 2) {
                xMin = -3*Math.sqrt((sampleSize+0.0)/(sampleSize - 2.0));
                xMax =  3*Math.sqrt((sampleSize+0.0)/(sampleSize - 2.0));
            } else {
                xMin = -5;
                xMax = 5;
            }
        }
        if (showBoxHist) {
            xMin = Math.min(popMin, xMin);
            xMax = Math.max(popMax, xMax);
        }
    }

    function setSampleSize(size) {
        sampleSize = size;
        adjustSampleSize();
        showPlot();
    }

    function adjustSampleSize() {
        minSampleSize = 1;
        if (varChoice.selected() == "Sample S-Squared" || varChoice.selected() == "Sample t") {
            minSampleSize = 2;
        }
        if ( !replaceCheck.is(':checked') ) {
            maxSampleSize = pop.length;
        } else {
            maxSampleSize = maxMaxSampleSize;
        }
        sampleSize = Math.max(sampleSize,minSampleSize);
        sampleSize = Math.min(sampleSize,maxSampleSize);
        //sampleSizeBar.setValues(sampleSize,minSampleSize,maxSampleSize,1);
        //TODO(jmeady): Allow bounds on this.
        sampleSizeBar.val(sampleSize);
    }

    function setCurve() {
      var sd = 0;                         // sd for normal approx
      var mu = 0;                         // mean for normal approx
      hist.curves([null, null]);
      var fpc = 1.0;
      var popVar = popSd*popSd;
      if ( !replaceCheck.is(':checked') ) {
        popVar = popVar*pop.length/(pop.length-1.0);
      }
      if (!replaceCheck.is(':checked')) {
        fpc = Math.sqrt( (pop.length - sampleSize + 0.0)/(pop.length-1.0));
      }
      if (curveChoice.selected() == "No Curve") {
        hist.hideCurves();
      } else {
        hist.showCurves();
        if (curveChoice.selected() == "Chi-Squared Curve") {
          if (varChoice.selected() == "Sample S-Squared") {
            var scale = (sampleSize - 1.0)/(popVar);
            // change of variables: (n-1)*S^2/sigma^2 ~ Chi^2_{n-1}
            hist.curves(1, function(x) {
              return scale*chi2Pdf(sampleSize-1.0, x * scale);
            });
          } else if (varChoice.selected() == "Sample Chi-Squared") {
            hist.curves(1, function(x) {
              return chi2Pdf(pop.length-1.0, x);
            });
          } else {
            console.warn("Warning in SampleDist.setCurve(): Chi-squared " +
                         "approximation to " +
                         varChoice.selected() + " Not Supported!");
            curveChoice.select("No Curve");
            hist.hideCurves();
            return(false);
          }
        } else if (curveChoice.selected() == "Normal Curve") {
          if (varChoice.selected() == "Sample Mean") {
            sd = fpc*popSd/Math.sqrt(sampleSize + 0.0);
            mu = popMean;
          } else if (varChoice.selected() == "Sample Sum") {
            sd = fpc*popSd * Math.sqrt(sampleSize + 0.0);
            mu = popMean * sampleSize;
          } else if (varChoice.selected() == "Sample S-Squared") {
            // E(chi^2) = (n-1), so E( sigma^2 chi^2 / (n-1) = sigma^2.
            // SD(chi^2) = sqrt(2(n-1)), so SD( sigma^2 chi^2/ (n-1)) = sqrt(2/(n-1)) sigma^2.
            sd = Math.sqrt(2.0/(sampleSize-1.0))*popSd*popSd; // FIX ME!
            // doesn't account for no replacement
            mu = popVar;
          } else if (varChoice.selected() == "Sample Chi-Squared") {
            sd = Math.sqrt(2.0*(pop.length-1.0));
            mu = pop.length-1;
          } else if (varChoice.selected() == "Sample t") {
            if (sampleSize > 2) {
              sd = sampleSize/(sampleSize-2.0);
            } else {
              sd = NaN;
              console.warn("Warning in SampleDist.setCurve(): normal " +
                           "approximation to Student t with sample size <= 2 " +
                           " Not Supported!");
              curveChoice.select("No Curve");
              hist.hideCurves();
              return(false);
            }
            mu = 0;
          }
          hist.curves(1, function(x) {
            return normPdf(mu, sd, x);
          });
        } else if (curveChoice.selected() == "Student t Curve") {
          if (varChoice.selected() == "Sample t") {
            hist.curves(1, function(x) {
              return tPdf(sampleSize-1, x);
            });
          } else {
            console.warn("Warning in SampleDist.setCurve(): Student t " +
                         "approximation to " + varChoice.selected() +
                         " Not Supported!");
            curveChoice.select("No Curve");
            hist.hideCurves();
            return(false);
          }
        }
      }
      return(true);
    }

    function hiLitArea() {
      var area = 0;
      for (var i=0; i < nBins; i++) {
        if( binEnd[i]  > hiLiteHi ||  binEnd[i+1] <= hiLiteLo) {
        } else if (binEnd[i] >= hiLiteLo && binEnd[i+1] <= hiLiteHi) {
          area += countSample[i]*(binEnd[i+1]-binEnd[i]);
        } else if (binEnd[i] >= hiLiteLo && binEnd[i+1] > hiLiteHi) {
          area += countSample[i]*(hiLiteHi - binEnd[i]);
        } else if (binEnd[i] <= hiLiteLo && binEnd[i+1] <= hiLiteHi) {
          area += countSample[i]*(binEnd[i+1]-hiLiteLo);
        } else if (binEnd[i] < hiLiteLo && binEnd[i+1] > hiLiteHi) {
          area += countSample[i]*(hiLiteHi - hiLiteLo);
        }
      }
      return(area);
    } // ends hiLitArea()


    function normHiLitArea() {
        var area = 0;
        var fpc = 1.0;
        if (!replaceCheck.is(':checked')) {
            fpc = Math.sqrt( (pop.length - sampleSize + 0.0)/(pop.length-1.0));
        }
        if (hiLiteHi > hiLiteLo) {
           area = normCdf((hiLiteHi - EX)/(fpc*SE)) - normCdf((hiLiteLo - EX)/(fpc*SE));
        }
        return(area);
    }// ends normHiLitArea

    function chiHiLitArea() {
       var area = 0;
       if (hiLiteHi > hiLiteLo) {
           if (varChoice.selected() == "Sample S-Squared") {
               var scale = (sampleSize - 1.0)/(popSd*popSd);
               area = chi2Cdf(sampleSize-1, scale*hiLiteHi) -
                      chi2Cdf(sampleSize-1, scale*hiLiteLo);
           } else if (varChoice.selected() == "Sample Chi-Squared") {
               area = chi2Cdf(pop.length-1, hiLiteHi) -
                      chi2Cdf(pop.length-1, hiLiteLo);
           } else {
               console.error("Error in SampleDist.chiHiLitArea(): " + varChoice.selected() +
                      " not supported. ");
               area = 0.0;
           }
       }
       return(area);
    }// ends chiHiLitArea

    function tHiLitArea() {
       var area = 0;
       if (hiLiteHi > hiLiteLo) {
           if (varChoice.selected() == "Sample t") {
               area = tCdf(sampleSize-1, hiLiteHi) -
                      tCdf(sampleSize-1, hiLiteLo);
           } else {
               console.error("Error in SampleDist.tHiLitArea(): " + varChoice.selected() +
                      " not supported. ");
               area = 0.0;
           }
       }
       return(area);
    }// ends chiHiLitArea

    init();
}
