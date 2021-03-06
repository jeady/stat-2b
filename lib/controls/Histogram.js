// Author: James Eady <jeady@berkeley.edu>
//
// This file defines a javascript control that displays a histogram.
//
// Usage:
// TODO(jmeady): Add Usage.
function SticiHistogram(params) {
  var self = this;

  // Make this object jQuery compatible by making it a jQuery object.
  self = jQuery('<div/>').addClass('stici_histogram');

  // Options.
  var options = {
    hiLiteLo: 0,
    hiLiteHi: 0,
    binEnds: [0, 10, 20, 30, 40, 50, 60],
    showCurves: true,

    // These can be either arrays of binCount arrays/curves or a single
    // binCount array and curve.
    binCounts: [[2, 8, 10, 17, 3, 5], [5, 10, 15, 12, 8, 2]],
    curves: [function(x) {return 7;}, function(x) {return 13;}]
  };
  jQuery.extend(options, params);

  // Private handle to the overlay to adjust the highlighting.
  var overlay = null;

  // If the given binCounts/curves are not arrays, make them single-element
  // arrays. This means we can use the same code regardless of how many
  // overlain histograms there are.
  if (!(options.binCounts[0] instanceof Array))
    options.binCounts = [options.binCounts];
  if (!(options.curves) instanceof Array)
    options.curves = [options.curves];

  // Accessor and modifier functions.
  self.hilite = function(lo, hi) {
    if (lo !== undefined)
      options.hiLiteLo = lo;
    if (hi !== undefined)
      options.hiLiteHi = hi;

    var bounds = calculateBounds();
    var scale = self.width() / (bounds.x_hi - bounds.x_lo);
    var left = (options.hiLiteLo - bounds.x_lo) * scale;
    var right = (options.hiLiteHi - bounds.x_lo) * scale;
    overlay.css(
      'clip',
      'rect(0px,' + right + 'px,' + self.height() + 'px,' + left + 'px)');

    if (lo !== undefined || hi !== undefined)
      return self;
    else
      return [options.hiLiteLo, options.hiLiteHi];
  };
  self.binEnds = function(ends) {
   if (ends !== undefined) {
     options.binEnds = ends;
     self.redraw();
     return self;
   }
   return options.binEnds;
  };
  self.showCurves = function(show) {
    if (show === undefined)
      show = true;
    options.showCurves = show;
    self.redraw();
    return self;
  };
  self.hideCurves = function() {
    options.showCurves = false;
    self.redraw();
    return self;
  };

  // The following functions are rather magical. If only a single histogram is
  // being displayed, 'i' can always be ommitted and all arguments/return
  // values will traffic in the binCounts array and curve function directly
  // (e.g. set([2,3,4], [5,6], function(x) {return 7;});). If multiple
  // histograms are being displayed, however, they will traffic in arrays
  // of bin count arays and curve functions.
  self.binCounts = function(i, counts) {
    if (counts === undefined && options.binCounts.length == 1) {
      // Single-histogram mode.
      counts = i;
      if (counts === undefined)
        return options.binCounts[0];

      setBinCounts(counts);
      self.redraw();
      return self;
    } else {
      // Multi-histogram mode
      if (i === undefined)
        return options.binCounts;

      if (!isFinite(i)) {
        setBinCounts(i);
        self.redraw();
        return self;
      }

      if (counts === undefined)
        return options.binCounts[i];

      options.binCounts[i] = counts;
      self.redraw();
      return self;
    }
  };
  self.curves = self.curve = function(i, curve) {
    if (curve === undefined && options.curves.length == 1) {
      // Single-histogram mode.
      curve = i;
      if (curve === undefined)
        return options.curves[0];

      setCurves(curves);
      self.redraw();
      return self;
    } else {
      // Multi-histogram mode
      if (i === undefined)
        return options.curves;

      if (!isFinite(i)) {
        setCurves(i);
        self.redraw();
        return self;
      }

      if (curve === undefined)
        return options.curves[i];

      options.curves[i] = curve;
      self.redraw();
      return self;
    }
  };
  self.set = function(binEnds, binCounts, curves) {
    if (curves === undefined)
      curves = [];

    options.binEnds = binEnds;
    setBinCounts(binCounts);
    setCurves(curves);
    self.redraw();
    return self;
  };

  // These methods provide validation so we prefer them over setting variables
  // directly.
  function setBinCounts(binCounts) {
    if (!(binCounts[0] instanceof Array))
      binCounts = [binCounts];

    binCounts = jQuery.map(binCounts, function(counts) {
      return [jQuery.map(counts, function(v) {
        if (v === undefined || v === null || isNaN(v))
          return 0;
        return v;
      })];
    });

    options.binCounts = binCounts;
  }
  function setCurves(curves) {
    if (!(curves instanceof Array))
      curves = [curves];

    options.curves = curves;
  }

  // This can be called in the case that our size has changed.
  self.redraw = function() {
    // Clear everything.
    self.children().remove();

    // Don't try to draw if we cannot be seen.
    if (!self.is(':visible') || self.width() === 0 || self.height() === 0)
      return;

    // Basic pieces. Use these to enforce ordering.
    overlay = jQuery('<div/>').addClass('chart_box overlay');
    var chart = jQuery('<div/>').addClass('chart_box');
    var curves = jQuery('<div/>').addClass('chart_box');
    var axis = jQuery('<div/>').addClass('chart_box axis');
    self.append(chart, overlay, curves, axis);

    // Hide the overlay. This clip will be controlled to highlight sections.
    overlay.css('clip', 'rect(0px, 0px, ' + height + 'px, 0px)');

    // Basic chart parameters.
    var width = self.width();
    var height = self.height() - axis.height();
    var bounds = calculateBounds();
    var yScale = bounds.y_hi / (height - 1);

    // Draw the axis
    if (!isNaN(bounds.width) && isFinite(bounds.width) && bounds.width > 0) {
      var scale =
        d3.scale.linear()
          .domain([bounds.x_lo, bounds.x_hi])
          .range([0, width]);
      d3.select(axis.get(0))
        .append('svg')
        .append('g').call(d3.svg.axis().scale(scale).orient('bottom'));
    }

    if (isNaN(bounds.width) ||
        !isFinite(bounds.width) ||
        bounds.width === 0 ||
        isNaN(bounds.height) ||
        !isFinite(bounds.height) ||
        bounds.height === 0) {
      console.warn("Histogram not rendering invalid data.");
      return;
    }

    // Draw the bins. Iterate once for each set of binCounts, but draw them so
    // that the tallest bins regardless of binCounts set get rendered first,
    // and are therefore in the back.
    var interleaved = interleaveAndSortBinCounts();
    jQuery.each(options.binCounts, function(i) {
      d3.select(chart.get(0))
        .append('svg')
        .selectAll('div')
        .data(interleaved)
        .enter()
        .append('rect')
        .attr('y', function(d) { return height - d[i][0] / yScale; })
        .attr('height', function(d) {
          var height = d[i][0] / yScale;
          if (height < 0.0001)
            height = 0;
          return height;
        })
        .attr('x', function(d, i) {
          return (width * (options.binEnds[i] - bounds.x_lo) / bounds.width);
        })
        .attr('width', function(d, i) {
          return width * (options.binEnds[i + 1] - options.binEnds[i]) /
            bounds.width;
        })
        .attr('class', function(d) {
          return 'set' + d[i][1];
        });
    });

    // Create the hilite overlay.
    overlay.append(chart.children().clone().detach());

    // Draw the curves.
    if (options.showCurves) {
      jQuery.each(options.curves, function(i, curve) {
        if (curve === undefined || curve === null)
          return;

        var line =
          d3.svg.line()
            .x(function(d) {return d;})
            .y(function(d) {
              // Convert the pixel offset to a usable x-coordinate that means
              // something to the curve.
              var x = bounds.x_lo + d * bounds.width / width;
              var y = height - (curve(x) / yScale);
              if (isNaN(y))
                return 0;
              return y;
            });
        d3.select(curves.get(0))
          .append('svg')
          .append('path')
          .attr('class', 'set' + i)
          .data([range(0, width)])
          .attr('d', line);
      });
    }

    // Reset the highlight position.
    self.hilite();
  };

  // Calculates the chart bounds from the binCounts and curves.
  function calculateBounds() {
    var bounds = {
      x_lo: Infinity,
      x_hi: -Infinity,
      width: -Infinity,
      y_lo: 0, // We don't allow negative bin counts.
      y_hi: -Infinity,
      height: -Infinity
    };

    // X range is easy to calculate.
    bounds.x_lo = options.binEnds.min();
    bounds.x_hi = options.binEnds.max();
    bounds.width = bounds.x_hi - bounds.x_lo;

    // Y height can be bounded either by the curve or by the bins. Check both,
    // and watch out for NaN.
    var boxHi =
      jQuery.map(options.binCounts, function(a) {
        if (a === undefined || a === null || a.length === 0)
          return -Infinity;

        return a.max();
      }).max();
    var curveHi =
        jQuery.map(options.curves, function(c) {
          if (c === undefined || c === null)
            return -Infinity;

          return jQuery.grep(
            jQuery.map(range(0, self.width()), function(i) {
              return c((i / self.width()) * (bounds.x_hi - bounds.x_lo) + bounds.x_lo);
            }),
            isNaN,
            true).max();
        }).max();
    if (isNaN(curveHi))
      curveHi = -Infinity;

    bounds.y_hi = Math.max(curveHi, boxHi);
    bounds.height = bounds.y_hi - bounds.y_lo;

    return bounds;
  }

  // Interleaves the values from all of the binCounts. Each value is
  // transformed into a [value, binCountsIndex] pair. The resulting interleaved
  // elements are then sorted in descending order by value. For example:
  // Given:   [[1, 5, 8], [3, 9, 7], [2, 6, 4]]
  // Outputs: [[[3, 1], [2, 2], [1, 0]],
  //           [[9, 1], [6, 2], [5, 0]],
  //           [[8, 0], [7, 1], [4, 2]]]
  function interleaveAndSortBinCounts() {
    return jQuery.map(range(0, options.binEnds.length - 1), function(i) {
      // jQuery requires that we double-wrap this array because it flattens map
      // results.
      return [jQuery.map(options.binCounts, function(binCounts, set) {
        // Just use 0 if there is no count for this bin.
        if (i >= binCounts.length)
          return [[0, set]];

        return [[binCounts[i], set]];
      }).sort(function(a, b) {
        return b[0] - a[0];
      })];
    });
  }

  // Draw once before we return. All other draws will be triggered by events.
  self.redraw();

  return self;
}
