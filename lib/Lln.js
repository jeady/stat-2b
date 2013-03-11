// Javascript rewrite of
// http://statistics.berkeley.edu/~stark/Java/Html/lln.htm
//
// Author: James Eady <jeady@berkeley.edu>
//
// container_id: the CSS ID of the container to create the histogram (and
//               controls) in.
// params: A javascript object with various parameters to customize the chart.
//  // Show percentage mode by default.
//  - percent: false

function Stici_Lln(container_id, params) {
  var self = this;

  if (!params instanceof Object) {
    console.error('Stici_Lln params should be an object');
    return;
  }

  // Configuration option defaults.
  this.options = {
    percent: false
  };

  // For debugging: Warn of user params that are unknown.
  jQuery.each(params, function(key) {
    if (typeof(self.options[key]) == 'undefined')
      console.warn('Stici_Lln: Unknown key \'' + key + '\'');
  });

  // Override options with anything specified by the user.
  jQuery.extend(this.options, params);

  // jQuery object containing the entire chart.
  this.container = jQuery('#' + container_id);

  // The root object that holds everything.
  this.root = jQuery('<div/>').addClass('stici stici_lln');

  // The div that holds the chart SVG.
  this.chart = jQuery('<div/>').addClass('chart_box');

  // The div that holds the controls at the bottom.
  this.controls = jQuery('<div/>').addClass('controls');

  // The controls themselves.
  this.probability = new SticiTextBar({
    label: 'Chance of success (%)',
    value: 50,
    min: 0,
    max: 100,
    change: reset
  });
  this.trials = new SticiTextBar({
    label: '# Trials',
    value: 800,
    min: 1,
    max: 20000,
    change: redraw
  });
  this.percent = new SticiToggleButton({
    trueLabel: 'Number',
    falseLabel: 'Percent',
    value: this.options.percent,
    change: reset
  });

  // Compose everthing.
  this.container.append(this.root);
  this.root.append(this.chart, this.controls);
  this.controls.append(this.probability, this.trials, this.percent);
  this.chart.height(this.container.height() - this.controls.height());

  // The simulation data.
  this.simulations = [];

  // Reset the data and then redraw.
  function reset() {
    self.simulations = [];
    redraw();
  }

  // The drawing function.
  function redraw() {
    // Start from fresh slate.
    self.chart.children().remove();

    // Fetch the probability.
    var p = self.probability.val() / 100;

    // If the trials the user has specified doesn't match what we have, either
    // perform some more or cut some off.
    var n;
    var prev;
    if (self.simulations.length > self.trials.val())
      self.simulations = self.simulations.slice(0, self.trials.val());
    if (self.percent.val()) {  // Percent.
      if (self.simulations.length === 0) {
        self.simulations.push(-p * 100);
        if (rand.next() <= p)
          self.simulations[0] += 100;
      }
      while (self.simulations.length < self.trials.val()) {
        n = self.simulations.length;
        prev = self.simulations[n - 1];
        self.simulations.push((n * prev - 100 * p) / (n + 1));
        if (rand.next() <= p)
          self.simulations[n] += (100 / (n + 1));
      }
    } else {  // Number.
      if (self.simulations.length === 0) {
        self.simulations.push(-p);
        if (rand.next() <= p)
          self.simulations[0] += 1;
      }
      while (self.simulations.length < self.trials.val()) {
        n = self.simulations.length;
        prev = self.simulations[n - 1];
        self.simulations.push(prev - p);
        if (rand.next() <= p)
          self.simulations[n] += 1;
      }
    }

    // Draw the thing.
    var width = self.chart.width();
    var height = self.chart.height();
    var y_min = self.simulations.min();
    var y_max = self.simulations.max();
    var yScale = (y_max - y_min) / height;
    var line =
      d3.svg.line()
        .x(function(d) {return d;})
        .y(function(d) {
          // Convert the pixel offset to a usable x-coordinate that means
          // something.
          var x = Math.round(d * self.trials.val() / width);
          var y = height - ((self.simulations[x] - y_min) / yScale);
          if (isNaN(y))
            return 0;
          return y;
        });
    d3.select(self.chart.get(0))
      .append('svg')
      .append('path')
      .data([range(0, width)])
      .attr('d', line);
  }

  // Initial render.
  redraw();
}
