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
    max: 100
  });
  this.trials = new SticiTextBar({
    label: '# Trials',
    value: 800,
    min: 1,
    max: 20000
  });
  this.percent = new SticiToggleButton({
    trueLabel: 'Number',
    falseLabel: 'Percent',
    value: this.options.percent
  });

  // Compose everthing.
  this.container.append(this.root);
  this.root.append(this.chart, this.controls);
  this.controls.append(this.probability, this.trials, this.percent);
  this.chart.height(this.container.height() - this.controls.height());
}
