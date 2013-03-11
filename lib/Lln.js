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

  // The divs holding the SVGs.
  this.chart_box = jQuery('<div/>').addClass('chart_box');
  this.chart = jQuery('<div/>').addClass('simulation');
  this.x_axis = jQuery('<div/>').addClass('axis x_axis');
  this.y_axis = jQuery('<div/>').addClass('axis y_axis');

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
  this.root.append(this.chart_box, this.controls);
  this.chart_box.append(this.chart, this.x_axis, this.y_axis);
  this.controls.append(this.probability, this.trials, this.percent);
  this.chart_box.height(this.container.height() - this.controls.height());
  this.chart.height(this.chart_box.height() - this.x_axis.height());
  this.chart.width(this.chart_box.width() - this.y_axis.width());

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
    self.x_axis.children().remove();
    self.y_axis.children().remove();

    // Fetch the probability.
    var p = self.probability.val() / 100;
    var n_trials = self.trials.val();

    // If the trials the user has specified doesn't match what we have, either
    // perform some more or cut some off.
    var n;
    var prev;
    if (self.simulations.length > n_trials)
      self.simulations = self.simulations.slice(0, n_trials);
    if (self.percent.val()) {  // Percent.
      if (self.simulations.length === 0) {
        self.simulations.push(-p * 100);
        if (rand.next() <= p)
          self.simulations[0] += 100;
      }
      while (self.simulations.length < n_trials) {
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
      while (self.simulations.length < n_trials) {
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
          var x = Math.round(d * n_trials / width);
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

    // Draw the x axis.
    var xscale =
      d3.scale.linear()
        .domain([0, n_trials])
        .range([0, width]);
    d3.select(self.x_axis.get(0))
      .append('svg')
      .append('g')
      .call(d3.svg.axis().scale(xscale).orient('bottom'));
    self.x_axis.css('top', ((y_max / (y_max - y_min)) * height) + 'px');

    // Draw the y axis.
    var yscale =
      d3.scale.linear()
        .domain([y_max, y_min])
        .range([0, height]);
    d3.select(self.y_axis.get(0))
      .append('svg')
      .append('g')
      .attr("transform", "translate(" + self.y_axis.width() + ", 0)")
      .call(d3.svg.axis().scale(yscale).orient('left'));
  }

  // Initial render.
  redraw();
}
