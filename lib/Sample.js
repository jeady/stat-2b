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

    function drawSample(nSams) {}                                // purify
    function setSamLabel() {}                                    // UI
    function setAreas() {}                                       // UI

    // set the TextBars for hilight and sampleSize
    function setBars(l, h) {}                                    // purify

    function setBins(nBins, xMin, xMax, nPop, sourceType, varType, samplesSoFar) {
        var binEnd = new Array(nBins+1);
        for (var i=0; i < nBins+1; i++) {
            binEnd[i] = xMin + i*(xMax - xMin)/nBins;
        }
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

    function setLims() {}                                        // purify
    function setCurveLabel() {}                                  // UI
    function setSampleSize(size) {}                              // purify
    function adjustSampleSize() {}                               // purify
    function setCurve() {}                                       // purify
}
