function Stici_SampleDist(container_id, params) {
    var self = this;

    public void init() {}                                        // UI

    // compute population statistics
    protected void initPop() {}                                  // UI
    public boolean handleEvent(Event e) {}                       // UI
    protected boolean replaceOK(boolean rep) {}                  // UI

    // test what is to be plotted; adjust variables accordingly
    public void showPlot() {}                                    // UI

    // set things up when the variable is changed
    protected void newVariable(String lastVar) {}                // UI

    // parse new population
    public void setBox(String newBox, boolean updateBox) {}      // UI

    protected void drawSample(int nSams) {}                      // purify
    protected void setSamLabel() {}                              // UI
    public void setAreas() {}                                    // UI

    // set the TextBars for hilight and sampleSize
    public void setBars(double l, double h) {}                   // purify
    protected void setBins() {}                                  // purify
    private void setLims() {}                                    // purify
    protected double[] listToHist(double[] list, int lim) {}     // pure
    protected void setCurveLabel() {}                            // UI
    public void setSampleSize(int size) {}                       // purify
    protected void adjustSampleSize() {}                         // purify
    protected boolean setCurve() {}                              // purify
}
