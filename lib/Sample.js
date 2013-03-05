function Stici_SampleDist(container_id, params) {
    var self = this;

    public void init() {}

    // compute population statistics
    protected void initPop() {}
    public boolean handleEvent(Event e) {}
    protected boolean replaceOK(boolean rep) {}

    // test what is to be plotted; adjust variables accordingly
    public void showPlot() {}

    // set things up when the variable is changed
    protected void newVariable(String lastVar) {}

    // parse new population
    public void setBox(String newBox, boolean updateBox) {}
    public void setBox(String newBox) {}
    protected void drawSample(int nSams) {}
    protected void setSamLabel() {}
    public void setAreas() {}

    // set the TextBars for hilight and sampleSize
    public void setBars(double l, double h) {}

    // set TextBars
    public void setBars(String l, String h) {}
    protected void setBins() {}
    private void setLims() {}
    protected double[] listToHist(double[] list) {}
    protected double[] listToHist(double[] list, int lim) {}
    protected void setCurveLabel() {}
    public void setSampleSize(int size) {}
    public void setSampleSize(String size) {}
    protected void adjustSampleSize() {}
    protected boolean setCurve() {}
}
