function Stici_SampleDist(container_id, params) {
    var self = this;

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

    function drawSample(nSams) {
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
            if ( varChoice.getSelectedItem().equals("Sample Chi-Squared") ) {
                if (sourceChoice.getSelectedItem().equals("Box")) {
                    var cum = PbsStat.vCumSum(pop);     // cum expecting an Array
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
                    sampleSSq[samplesSoFar++] = ssq;
                    if (ssq < xMin || ssq > xMax) {
                        xMin = Math.min(ssq, xMin);
                        xMax = Math.max(ssq, xMax);
                    }
                } else {
                    System.out.println("Error in SampleDist.drawSample(): cannot draw from " +
                                       "this distribution with Sample Chi-Square!");
                }
            } else {
                if (sourceChoice.getSelectedItem().equals("Box")) {
                    if (replaceCheck.getState()) {
                        indices = PbsStat.listOfRandInts(sampleSize, 0, nPop-1);
                    } else {
                        indices = PbsStat.listOfDistinctRandInts(sampleSize, 0, nPop-1);
                    }
                    for (var i = 0; i < sampleSize; i++) {
                        theSample[i] = pop[ indices[i] ];
                        xb += theSample[i];
                    }
                } else if (sourceChoice.getSelectedItem().equals("Normal")) {
                    for (var i = 0; i < sampleSize; i++) {
                        theSample[i] = PbsStat.rNorm();
                        xb += theSample[i];
                    }
                } else if (sourceChoice.getSelectedItem().equals("Uniform")) {
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
                    sampleSSq[samplesSoFar] = ssq;
                    tStat = xb/(Math.sqrt(ssq)/Math.sqrt(sampleSize));
                    sampleT[samplesSoFar] = tStat;
                } else {                                          // otherwise, set to 0.
                    sampleSSq[samplesSoFar] = 0;
                    sampleT[samplesSoFar] = 0;
                }
                sampleMean[samplesSoFar++] = xb;                  // log the sample mean
                if (currVar.equals("Sample Mean")) {
                    if (xb < xMin || xb > xMax) {
                        xMin = Math.min(xb, xMin);
                        xMax = Math.max(xb, xMax);
                    }
                } else if (currVar.equals("Sample t")) {
                    if (tStat < xMin || tStat > xMax) {
                        xMin = Math.min(tStat, xMin);
                        xMax = Math.max(tStat, xMax);
		    }
                } else if ( currVar.equals("Sample Sum")) {
                    tmp = xb * sampleSize;
                    if (tmp < xMin || tmp > xMax) {
                        xMin = Math.min(tmp, xMin);
                        xMax = Math.max(tmp, xMax);
                    }
                } else if (currVar.equals("Sample S-Squared")) {
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
        if (sourceChoice.getSelectedItem().equals("Box") && nPop > 0) {
            if (varChoice.getSelectedItem().equals("Sample Chi-Squared")) {
                setCurve();
            } else {
                countPop = listToHist(pop, nPop);
                setCurve();
            }
        } else if (sourceChoice.getSelectedItem().equals("Normal")) {
            for (var i=0; i < nBins; i++ ) {
                countPop[i] = (PbsStat.normCdf(binEnd[i+1]) -
                               PbsStat.normCdf(binEnd[i]))/(binEnd[i+1] - binEnd[i]);
            }
        } else if (sourceChoice.getSelectedItem().equals("Uniform")) {
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
        if (samplesSoFar > 0 ) {
            if (currVar.equals("Sample S-Squared") || currVar.equals("Sample Chi-Squared")) {
                countSample = listToHist(sampleSSq, samplesSoFar);
            } else if (currVar.equals("Sample Mean")) {
                countSample = listToHist(sampleMean, samplesSoFar);
	    } else if (currVar.equals("Sample t")) {
		countSample = listToHist(sampleT, samplesSoFar);
            } else if (currVar.equals("Sample Sum")) {
                countSample = listToHist(PbsStat.scalVMult(sampleSize,sampleMean), samplesSoFar);
            }
        } else {
            for (var i=0; i < nBins; i++) {
                countSample[i] = 0;
            }
        }

        return (binEnd, countPop, countSample);
    }

    function setLims() {
        if (currVar.equals("Sample Sum")) {
            xMin = sampleSize * popMin; // these are the limits for the histogram
            xMax = sampleSize * popMax;
        } else if (currVar.equals("Sample Chi-Squared")) {
            xMin = 0.0;
            xMax = 10*Math.sqrt(pop.length - 1); // 5 SD
        } else if (currVar.equals("Sample S-Squared")) {
            xMin = 0.0;
            var maxDev = Math.max(popMean-popMin, popMax-popMean);
            xMax = 3*maxDev*maxDev/Math.sqrt(sampleSize);
        } else if (currVar.equals("Sample Mean")) {
            xMin = popMean-4*popSd/Math.sqrt(sampleSize);
            xMax = popMax+4*popSd/Math.sqrt(sampleSize);
        } else if (currVar.equals("Sample t")) {
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
        if (currVar.equals("Sample S-Squared") || currVar.equals("Sample t")) {
            minSampleSize = 2;
        }
        if ( !replaceCheck.getState() ) {
            maxSampleSize = nPop;
        } else {
            maxSampleSize = maxMaxSampleSize;
        }
        sampleSize = Math.max(sampleSize,minSampleSize);
        sampleSize = Math.min(sampleSize,maxSampleSize);
        sampleSizeBar.setValues(sampleSize,minSampleSize,maxSampleSize,1);
    }

    function setCurve() {
        var fpc = 1.0;
        var popVar = popSd*popSd;
        if ( !replaceCheck.getState() ) {
            popVar = popVar*nPop/(nPop-1.0);
        }
        if (!replaceCheck.getState()) {
            fpc = Math.sqrt( (nPop - sampleSize + 0.0)/(nPop-1.0));
        }
        xVal = new Array(nx);
        yVal = new Array(nx);
        if (curveChoice.getSelectedItem().equals("No Curve")) {
            showCurve = false;
        } else {
            showCurve = true;
            if (curveChoice.getSelectedItem().equals("Chi-Squared Curve")) {
                if (varChoice.getSelectedItem().equals("Sample S-Squared")) {
                    var scale = (sampleSize - 1.0)/(popVar);
                    // change of variables: (n-1)*S^2/sigma^2 ~ Chi^2_{n-1}
                    for (var i = 0; i < nx; i++) {
                        xVal[i] = xMin + i*(xMax - xMin)/(nx-1.0);
                        yVal[i] = scale*PbsStat.chi2Pdf(xVal[i]*scale, sampleSize-1.0);
                    }
                } else if (varChoice.getSelectedItem().equals("Sample Chi-Squared")) {
                    for (var i=0; i < nx; i++) {
                        xVal[i] = xMin + i*(xMax - xMin)/(nx-1.0);
                        yVal[i] = PbsStat.chi2Pdf(xVal[i], pop.length-1.0);
                    }
                } else {
                    System.out.println("Warning in SampleDist.setCurve(): Chi-squared " +
                                       "approximation to " +
                                       varChoice.getSelectedItem() + " Not Supported!");
                    curveChoice.select("No Curve");
                    showCurve = false;
                    return(false);
                }
            } else if (curveChoice.getSelectedItem().equals("Normal Curve")) {
                if (varChoice.getSelectedItem().equals("Sample Mean")) {
                    sd = fpc*popSd/Math.sqrt(sampleSize + 0.0);
                    mu = popMean;
                } else if (varChoice.getSelectedItem().equals("Sample Sum")) {
                    sd = fpc*popSd * Math.sqrt(sampleSize + 0.0);
                    mu = popMean * sampleSize;
                } else if (varChoice.getSelectedItem().equals("Sample S-Squared")) {
                    // E(chi^2) = (n-1), so E( sigma^2 chi^2 / (n-1) = sigma^2.
                    // SD(chi^2) = sqrt(2(n-1)), so SD( sigma^2 chi^2/ (n-1)) = sqrt(2/(n-1)) sigma^2.
                    sd = Math.sqrt(2.0/(sampleSize-1.0))*popSd*popSd; // FIX ME!
                    // doesn't account for no replacement
                    mu = popVar;
                } else if (varChoice.getSelectedItem().equals("Sample Chi-Squared")) {
                    sd = Math.sqrt(2.0*(pop.length-1.0));
                    mu = pop.length-1;
                } else if (varChoice.getSelectedItem().equals("Sample t")) {
		    if (sampleSize > 2) {
			sd = sampleSize/(sampleSize-2.0);
		    } else {
			sd = NaN;
			System.out.println("Warning in SampleDist.setCurve(): normal " +
					   "approximation to Student t with sample size <= 2 " +
					   " Not Supported!");
			curveChoice.select("No Curve");
			showCurve = false;
                    	return(false);
		    }
		    mu = 0;
		}
                for (var i = 0; i < nx; i++) {
                    xVal[i] = xMin + i*(xMax - xMin)/(nx-1);
                    yVal[i] = PbsStat.normPdf(mu, sd, xVal[i]);
                }
            } else if (curveChoice.getSelectedItem().equals("Student t Curve")) {
		if (varChoice.getSelectedItem().equals("Sample t")) {
		    for (var i = 0; i < nx; i++) {
			xVal[i] = xMin + i*(xMax - xMin)/(nx-1);
                    	yVal[i] = PbsStat.tPdf(xVal[i], sampleSize-1);
		    }
		} else {
		    System.out.println("Warning in SampleDist.setCurve(): Student t " +
				       "approximation to " + varChoice.getSelectedItem() +
				       " Not Supported!");
		    curveChoice.select("No Curve");
		    showCurve = false;
                    return(false);
		}
            }
        }
        return(true);
    }
}
