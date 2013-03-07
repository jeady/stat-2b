function Stici_SampleDist(container_id, params) {
    var self = this;

    // These are constants.
    var maxBins = 100;

    // User-configurable parameters. These are directly lifted from
    // SampleDist.java. I don't know what the commented ones are yet, nor what
    // their default values should be. -jeady
    this.options = {
        binControls: true,
        bins: maxBins,
        //boxContents: ,
        boxEditable: true,
        boxHistControl: false,
        curveControls: true,
        //curves: ,
        hiLiteHi: 0.0,
        hiLiteLo: 0.0,
        replace: true,
        replaceControl: false,
        sampleSize: 5,
        samplesToTake: 1,
        showBoxHist: true,
        showCurve: false,
        //sources: ",
        //startWith: ,
        statLabels: true,
        toggleVar: true,
        //variables:,
    };
    jQuery.extend(this.options, params);

    function init() {}                                           // UI

    // compute population statistics
    function initPop() {}                                        // UI
    function handleEvent(e) {}                                   // UI
    function replaceOK(rep) {}                                   // UI

    // test what is to be function accordingly
    function showPlot() {}                                       // UI

    // set things up when the variable is changed
    function newVariable(lastVar) {}                             // UI

    // function population
    function updateBox(newBox, updateBox) {}                     // UI

    function setSamLabel() {}                                    // UI
    function setAreas() {}                                       // UI

    function setCurveLabel() {}                                  // UI

    function drawSample(nSams, sampleSize, sourceType, varType) {
        var theSample = new Array(sampleSize);
        var indices = new Array(sampleSize);
        var xb;
        var ssq;
        var tStat;
        var tmp;
        for (var j=0; j < nSams; j++) {
            xb = 0;
            ssq = 0;
            tStat = 0;
            if ( varType() == "Sample Chi-Squared")  {                                  // stub
                if (sourceType() == "Box") {
                    var cum = vCumSum(pop);     // cum expecting an Array
                    var count = new Array(pop.length); // count expecting an Array
                    for (var i=0; i < pop.length; i++) {
                        count[i] = 0.0;
                    }
                    for (var i=0; i < sampleSize; i++) {
                        tmp = Math.random();
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
                    for ( var i=0; i < pop.length; i++) {
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
                if (sourceType() == "Box") {
                    if (replaceCheck()) {                                               // stub
                        indices = listOfRandInts(sampleSize, 0, nPop-1);
                    } else {
                        indices = listOfDistinctRandInts(sampleSize, 0, nPop-1);
                    }
                    for (var i = 0; i < sampleSize; i++) {
                        theSample[i] = pop[ indices[i] ];
                        xb += theSample[i];
                    }
                } else if (sourceType() == "Normal") {
                    for (var i = 0; i < sampleSize; i++) {
                        theSample[i] = rNorm();
                        xb += theSample[i];
                    }
                } else if (sourceType() == "Uniform") {
                    for (var i = 0; i < sampleSize; i++) {
                        theSample[i] = Math.random();
                        xb += theSample[i];
                    }
                }
                xb /= sampleSize;
                for (var i = 0; i < sampleSize; i++) {
                    ssq += (theSample[i] - xb)*(theSample[i] - xb);
                }
                if (sampleSize > 1) {                             // if n>1, log the sample s^2 and t
                    ssq /= (sampleSize-1);
                    sampleSSq[samplesSoFar()] = ssq;                                    // stub
                    tStat = xb/(Math.sqrt(ssq)/Math.sqrt(sampleSize));
                    sampleT[samplesSoFar()] = tStat;                                    // stub
                } else {                                          // otherwise, set to 0.
                    sampleSSq[samplesSoFar()] = 0;                                      // stub
                    sampleT[samplesSoFar()] = 0;                                        // stub
                }
                sampleMean[samplesSoFar++] = xb;                  // log the sample mean        // FIX: aculich 2013-03-06
                if (currVar() == "Sample Mean") {                                       // stub
                    if (xb < xMin || xb > xMax) {
                        xMin = Math.min(xb, xMin);
                        xMax = Math.max(xb, xMax);
                    }
                } else if (currVar() == "Sample t") {                                   // stub
                    if (tStat < xMin || tStat > xMax) {
                        xMin = Math.min(tStat, xMin);
                        xMax = Math.max(tStat, xMax);
                    }
                } else if ( currVar() == "Sample Sum") {                                // stub
                    tmp = xb * sampleSize;
                    if (tmp < xMin || tmp > xMax) {
                        xMin = Math.min(tmp, xMin);
                        xMax = Math.max(tmp, xMax);
                    }
                } else if (currVar() == "Sample S-Squared") {                           // stub
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
        hi.setValues(h, xMin, xMax, nDigs);
        lo.setValues(l, xMin, xMax, nDigs);
        hiLiteLo = l;
        hiLiteHi = h;
        adjustSampleSize();
    }

    function setBins(nBins, xMin, xMax, nPop, sourceType, varType, samplesSoFar) {
        var binEnd = histSetBins(nBins, xMin, xMax)
        var countPop = new Array(nBins);
        var countSample = new Array(nBins);
        if (sourceType() == "Box" && nPop > 0) {
            if (varType() == "Sample Chi-Squared") {                                    // stub
                setCurve();
            } else {
                countPop = listToHist(pop, nPop);
                setCurve();
            }
        } else if (sourceType() == "Normal") {
            for (var i=0; i < nBins; i++ ) {
                countPop[i] = (normCdf(binEnd[i+1]) -
                               normCdf(binEnd[i]))/(binEnd[i+1] - binEnd[i]);
            }
        } else if (sourceType() == "Uniform") {
            var midPt;
            for (var i=0; i < nBins; i++) {
                midPt = (binEnd[i]+binEnd[i+1])/2;
                if (midPt >= 0 && midPt <= 1) {
                    countPop[i] = 1;
                } else {
                    countPop[i] = 0;
                }
            }
        }
        if (samplesSoFar() > 0 ) {                                                      // stub
            if (currVar() == "Sample S-Squared" || currVar().equals("Sample Chi-Squared")) {    // stub
                countSample = listToHist(sampleSSq, samplesSoFar());                    // stub
            } else if (currVar() == "Sample Mean") {                                    // stub
                countSample = listToHist(sampleMean, samplesSoFar());                   // stub
            } else if (currVar() == "Sample t") {                                       // stub
                countSample = listToHist(sampleT, samplesSoFar());                      // stub
            } else if (currVar() == "Sample Sum") {                                     // stub
                countSample = listToHist(scalVMult(sampleSize,sampleMean), samplesSoFar());     // stub
            }
        } else {
            for (var i=0; i < nBins; i++) {
                countSample[i] = 0;
            }
        }

        return (binEnd, countPop, countSample);
    }

    function setLims(xMin, xMax, sampleSize, pop, popMin, popMax, popMean, popSd) {
        if (currVar() == "Sample Sum") {                                                // stub
            xMin = sampleSize * popMin; // these are the limits for the histogram
            xMax = sampleSize * popMax;
        } else if (currVar() == "Sample Chi-Squared") {                                 // stub
            xMin = 0.0;
            xMax = 10*Math.sqrt(pop.length - 1); // 5 SD
        } else if (currVar() == "Sample S-Squared") {                                   // stub
            xMin = 0.0;
            var maxDev = Math.max(popMean-popMin, popMax-popMean);
            xMax = 3*maxDev*maxDev/Math.sqrt(sampleSize);
        } else if (currVar() == "Sample Mean") {                                        // stub
            xMin = popMean-4*popSd/Math.sqrt(sampleSize);
            xMax = popMax+4*popSd/Math.sqrt(sampleSize);
        } else if (currVar() == "Sample t") {                                           // stub
            if (sampleSize > 2) {
                xMin = -3*Math.sqrt((sampleSize+0.0)/(sampleSize - 2.0));
                xMax =  3*Math.sqrt((sampleSize+0.0)/(sampleSize - 2.0));
            } else {
                xMin = -5;
                xMax = 5;
            }
        }
        if (showBoxHist()) {
            xMin = Math.min(popMin, xMin);
            xMax = Math.max(popMax, xMax);
        }
    }

    function setSampleSize(size) {
        sampleSize = size;
        adjustSampleSize();
        showPlot();
    }

    function adjustSampleSize(minSampleSize, maxSampleSize, maxMaxSampleSize, sampleSize, sampleSizeBar, nPop) {
        minSampleSize = 1;
        if (currVar() == "Sample S-Squared" || currVar() == "Sample t") {               // stub
            minSampleSize = 2;
        }
        if ( !replaceCheck() ) {                                                        // stub
            maxSampleSize = nPop;
        } else {
            maxSampleSize = maxMaxSampleSize;
        }
        sampleSize = Math.max(sampleSize,minSampleSize);
        sampleSize = Math.min(sampleSize,maxSampleSize);
        sampleSizeBar.setValues(sampleSize,minSampleSize,maxSampleSize,1);
    }

    function setCurve(xMin, xMax, pop, popMean, popSd, nPop, sampleSize, xVal, yVal, nx, sd, mu) {
        var fpc = 1.0;
        var popVar = self.popSd*self.popSd;
        if ( !replaceCheck() ) {                                                        // stub
            popVar = popVar*nPop/(nPop-1.0);
        }
        if (!replaceCheck()) {                                                          // stub
            fpc = Math.sqrt( (nPop - sampleSize + 0.0)/(nPop-1.0));
        }
        xVal = new Array(nx);
        yVal = new Array(nx);
        if (curveType() == "No Curve") {                                                // stub
            showCurve(false);                                                           // stub
        } else {
            showCurve(true);                                                            // stub
            if (curveType()() == "Chi-Squared Curve") {                                 // stub
                if (varType() == "Sample S-Squared") {                                  // stub
                    var scale = (sampleSize - 1.0)/(popVar);
                    // change of variables: (n-1)*S^2/sigma^2 ~ Chi^2_{n-1}
                    for (var i = 0; i < nx; i++) {
                        xVal[i] = xMin + i*(xMax - xMin)/(nx-1.0);
                        yVal[i] = scale*chi2Pdf(xVal[i]*scale, sampleSize-1.0);
                    }
                } else if (varType() == "Sample Chi-Squared") {                         // stub
                    for (var i=0; i < nx; i++) {
                        xVal[i] = xMin + i*(xMax - xMin)/(nx-1.0);
                        yVal[i] = chi2Pdf(xVal[i], pop.length-1.0);
                    }
                } else {
                    console.warn("Warning in SampleDist.setCurve(): Chi-squared " +
                                 "approximation to " +
                                 varType() + " Not Supported!");                        // stub
                    curveChoice.select("No Curve");
                    showCurve(false);                                                   // stub
                    return(false);
                }
            } else if (curveType() == "Normal Curve") {                                 // stub
                if (varType() == "Sample Mean") {                                       // stub
                    sd = fpc*popSd/Math.sqrt(sampleSize + 0.0);
                    mu = popMean;
                } else if (varType() == "Sample Sum") {                                 // stub
                    sd = fpc*popSd * Math.sqrt(sampleSize + 0.0);
                    mu = popMean * sampleSize;
                } else if (varType() == "Sample S-Squared") {                           // stub
                    // E(chi^2) = (n-1), so E( sigma^2 chi^2 / (n-1) = sigma^2.
                    // SD(chi^2) = sqrt(2(n-1)), so SD( sigma^2 chi^2/ (n-1)) = sqrt(2/(n-1)) sigma^2.
                    sd = Math.sqrt(2.0/(sampleSize-1.0))*popSd*popSd; // FIX ME!
                    // doesn't account for no replacement
                    mu = popVar;
                } else if (varType() == "Sample Chi-Squared") {                         // stub
                    sd = Math.sqrt(2.0*(pop.length-1.0));
                    mu = pop.length-1;
                } else if (varType() == "Sample t") {                                   // stub
                    if (sampleSize > 2) {
                        sd = sampleSize/(sampleSize-2.0);
                    } else {
                        sd = NaN;
                        console.warn("Warning in SampleDist.setCurve(): normal " +
                                     "approximation to Student t with sample size <= 2 " +
                                     " Not Supported!");
                        curveChoice.select("No Curve");
                        showCurve(false);                                               // stub
                        return(false);
                    }
                    mu = 0;
                }
                for (var i = 0; i < nx; i++) {
                    xVal[i] = xMin + i*(xMax - xMin)/(nx-1);
                    yVal[i] = normPdf(mu, sd, xVal[i]);
                }
            } else if (curveType() == "Student t Curve") {                              // stub
                if (varType() == "Sample t") {                                          // stub
                    for (var i = 0; i < nx; i++) {
                        xVal[i] = xMin + i*(xMax - xMin)/(nx-1);
                        yVal[i] = tPdf(xVal[i], sampleSize-1);
                    }
                } else {
                    console.warn("Warning in SampleDist.setCurve(): Student t " +
                                 "approximation to " + varType() +                      // stub
                                 " Not Supported!");
                    curveChoice.select("No Curve");
                    showCurve(false);                                                   // stub
                    return(false);
                }
            }
        }
        return(true);
    }
}
