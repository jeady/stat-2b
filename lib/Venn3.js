// Javascript implementation of venn diagram for sticigui. No params are
// currently available.
//
// container_id: the CSS ID of the container to create the venn diagram (and
//               controls) in.
// params: A javascript object with various parameters to customize the chart.
//  // Whether or not to render the conditional probability radio buttons.
//  - showConditional: false

function Stici_Venn3(container_id, params) {
  var self = this;

  this.env = jQuery('#' + container_id);
  var app = jQuery('<div/>',{id:container_id + 'app'})
              .addClass('stici_venn')
              .addClass('stici_venn3')
              .addClass('stici');
  this.env.append(app);


  // Configuration option defaults.
  this.options = {
    showConditional: false
  };

  // Override options with anything specified by the user.
  jQuery.extend(this.options, params);

  this.container = jQuery('<div/>',{id:container_id + 'container'}).addClass('container');
  var buttons_div = jQuery('<div/>',{id:container_id + 'buttons'}).addClass('buttons');
  var scrollbars = jQuery('<div/>',{id:container_id + 'scrollbars'}).addClass('scrollbars');

  app.append(self.container);
  app.append(buttons_div);
  app.append(scrollbars);

  this.container.css('width',(this.env.width() - buttons_div.width()) + 'px');
  this.container.css('height', (this.env.height() - scrollbars.height()) + 'px');

  var s_outline, a_outline, b_outline, c_outline;
  var a_fill, b_fill, c_fill, ab_fill, ac_fill, bc_fill, abc_fill;

  // Create all of the html objects so we can get handles to them and all. Then
  // create the controls.
  draw();

  // Array of row arrays. E.g.:
  //
  // A B C
  // X Y C
  //
  // Is represented as
  // [[A, B, C],
  //  [X, Y, Z]]
  this.buttons_arr = [
    [{label: 'A', filled: a_fill},
     {label: 'B', filled: b_fill},
     {label: 'C', filled: c_fill},
     {label: 'Ac', filled: s_outline, opaque: a_fill}],

    [{label: 'Bc', filled: s_outline, opaque: b_fill},
     {label: 'Cc', filled: s_outline, opaque: c_fill},
     {label: 'AB', filled: ab_fill},
     {label: 'AC', filled: ac_fill}],

    [{label: 'BC', filled: bc_fill},
     {label: 'A or B', filled: [a_fill, b_fill]},
     {label: 'A or C', filled: [a_fill, c_fill]},
     {label: 'B or C', filled: [b_fill, c_fill]}],

    [{label: 'ABC', filled: abc_fill},
     {label: 'A or B or C', filled: [a_fill, b_fill, c_fill]},
     {label: 'ABc', filled: a_fill, opaque: ab_fill},
     {label: 'AcB', filled: b_fill, opaque: ab_fill}],

    [{label: 'AcBC', filled: bc_fill, opaque: abc_fill},
     {label: 'Ac or BC', filled: [bc_fill, s_outline], opaque: a_fill},
     {label: 'S', filled: s_outline},
     {label: '{}'}]
  ];

  if (this.options.showConditional) {
    self.buttons_arr.push(
      [{label: 'P(A|B)', filled: b_fill, hilite: ab_fill},
       {label: 'P(Ac|B)', filled: ab_fill, hilite: b_fill},
       {label: 'P(B|A)', filled: a_fill, hilite: ab_fill}]);

    self.buttons_arr.push(
      [{label: 'P(A|BC)', filled: bc_fill, hilite: abc_fill},
       {label: 'P(Ac|BC)', filled: abc_fill, hilite: bc_fill},
       {label: 'P(A|(B or C))', filled: [b_fill, c_fill], hilite: [ab_fill, ac_fill]}]);
  }

  self.buttons = {};
  self.buttons_arr = $.map(self.buttons_arr, function(button_row) {
    var row = jQuery('<div/>').addClass('button_row');
    button_row = $.map(button_row, function(button) {
      button.human_label = button.label;
      button.label = button.label.replace('c', '<sup>c</sup>');
      button.label = button.label.replace('|', '&nbsp;|&nbsp;');
      button.label = button.label.replace(' or ', '&nbsp;\u222A&nbsp;');

      if (button.opaque !== undefined) {
        if (!(button.opaque instanceof Array))
          button.opaque = [button.opaque];
      } else {
        button.opaque = [];
      }
      if (button.filled !== undefined) {
        if (!(button.filled instanceof Array))
          button.filled = [button.filled];
      } else {
        button.filled = [];
      }
      if (button.hilite !== undefined) {
        if (!(button.hilite instanceof Array))
          button.hilite = [button.hilite];
      } else {
        button.hilite = [];
      }

      var button_div = jQuery('<div/>').addClass('button');
      button.div = button_div;
      row.append(button_div);
      var inp = jQuery('<input/>',{type:'radio',name:'buttons'});
      var label = jQuery('<label/>').click(function() {inp.prop('checked', true);});
      button_div.click(function() {
        inp.prop('checked', true);
        a_outline.removeClass('selected opaque hilite');
        b_outline.removeClass('selected opaque hilite');
        c_outline.removeClass('selected opaque hilite');
        a_fill.removeClass('selected opaque hilite');
        b_fill.removeClass('selected opaque hilite');
        c_fill.removeClass('selected opaque hilite');
        ab_fill.removeClass('selected opaque hilite');
        bc_fill.removeClass('selected opaque hilite');
        ac_fill.removeClass('selected opaque hilite');
        abc_fill.removeClass('selected opaque hilite');
        s_outline.removeClass('selected opaque hilite');

        $.each(button.opaque, function(i, opaque_element) {
          jQuery(opaque_element).addClass('opaque');
        });
        $.each(button.filled, function(i, fill_element) {
          jQuery(fill_element).addClass('selected');
        });
        $.each(button.hilite, function(i, fill_element) {
          jQuery(fill_element).addClass('hilite');
        });
      });
      label.html(button.label);
      var prob_span = jQuery('<div/>');
      label.append(prob_span);

      button.p = function(p) {
        if (isNaN(p))
          p = 0;
        prob_span.text(' (P = ' + (p / s_outline.area() * 100).fix(1) + '%)');
      };

      button_div.append(inp);
      button_div.append(label);

      self.buttons[button.human_label] = button;
      return button;
    });
    buttons_div.append(row);
    return button_row;
  });

  function createPercentControl(letter, size) {
    var sb = jQuery('<div/>',{id:container_id + 'psb' + letter}).addClass('scrollbar');
    var lbl = jQuery('<label/>').attr('for', container_id + 'sb'+letter);
    lbl.html('P(' + letter + ') (%)');
    var idFunc1 = function() {
      $('#' + container_id + 'sb' + letter).slider('value', this.value);
      updateSizes();
    };
    var idFunc2 = function() {
      $('#' + container_id + 'sb' + letter + 't').val($(this).slider('value'));
      updateSizes();
    };
    var input = jQuery('<input/>', {
      type: 'text',
      id: container_id + 'sb'+letter+'t',
      change: idFunc1,
      value: size,
      size: 2
    });
    var input2 =
      jQuery('<span/>')
        .addClass('slider')
        .attr('id', container_id + 'sb' + letter)
        .slider({
      change: idFunc2,
      slide: idFunc2,
      min: 1,
      max: 100,
      step: 1,
      value: size
    });

    sb.append(lbl);
    sb.append(input);
    sb.append(input2);

    scrollbars.append(sb);
  }
  createPercentControl('A', 30);
  createPercentControl('B', 20);
  createPercentControl('C', 10);

  updateSizes();

  function createBox() {
    var box = jQuery('<div/>').addClass('box');
    box.area = function() {
      if (box.css('display') == 'none')
        return 0;

      if (a_outline.isSameBox(box))
        return $('#' + container_id + 'sbA').slider('value') / 100 *
          s_outline.area();
      if (b_outline.isSameBox(box))
        return $('#' + container_id + 'sbB').slider('value') / 100 *
          s_outline.area();
      if (c_outline.isSameBox(box))
        return $('#' + container_id + 'sbC').slider('value') / 100 *
          s_outline.area();

      return box.width() * box.height();
    };
    box.x = function() {
      return box.position().left;
    };
    box.y = function() {
      return box.position().top;
    };
    box.isSameBox = function(other) {
      return box.y() == other.y() &&
             box.x() == other.x() &&
             box.width() == other.width() &&
             box.height() == other.height();
    };
    return box;
  }

  // Synchronizes fill positions so that the outline is always visible on the A
  // and B boxes, and the intersection area is synchronized.
  function syncPositions() {
    // Make sure everything stays in bounds.
    function bound(outline) {
      var x_offset = outline.offset().left + outline.width() -
        (s_outline.offset().left + s_outline.width());
      if (x_offset > 0)
        outline.css('left', (outline.position().left - x_offset) + 'px');
      var y_offset = outline.offset().top + outline.height() -
        (s_outline.offset().top + s_outline.height());
      if (y_offset > 0)
        outline.css('top', (outline.position().top - y_offset) + 'px');

      if (outline.position().left < s_outline.position().left)
        outline.css('left', s_outline.position().left + 'px');
      if (outline.position().top < s_outline.position().top)
        outline.css('top', s_outline.position().top + 'px');
    }
    function intersect(a, b, ab) {
      if (ab === undefined) {
        ab = createBox();
      }

      var a_x = a.position().left;
      var a_y = a.position().top;
      var a_w = a.width();
      var a_h = a.height();
      var b_x = b.position().left;
      var b_y = b.position().top;
      var b_w = b.width();
      var b_h = b.height();
      if (a_x + a_w < b_x || b_x + b_w < a_x ||
          a_y + a_h < b_y || b_y + b_h < a_y) {
        ab.css('display', 'none');
      } else {
        ab.css('display', '');
        var x1 = Math.max(a_x, b_x);
        var y1 = Math.max(a_y, b_y);
        ab.css('left', x1 + 'px');
        ab.css('top', y1 + 'px');
        var x2 = Math.min(a_x + a_w, b_x + b_w);
        var y2 = Math.min(a_y + a_h, b_y + b_h);
        ab.css('width', (x2 - x1) + 'px');
        ab.css('height', (y2 - y1) + 'px');
      }

      return ab;
    }
    bound(a_outline);
    bound(b_outline);
    bound(c_outline);

    // Synchronize the fills with the outlines.
    a_fill.css('left', a_outline.css('left'));
    a_fill.css('top', a_outline.css('top'));
    a_fill.css('width', a_outline.css('width'));
    a_fill.css('height', a_outline.css('height'));

    b_fill.css('left', b_outline.css('left'));
    b_fill.css('top', b_outline.css('top'));
    b_fill.css('width', b_outline.css('width'));
    b_fill.css('height', b_outline.css('height'));

    c_fill.css('left', c_outline.css('left'));
    c_fill.css('top', c_outline.css('top'));
    c_fill.css('width', c_outline.css('width'));
    c_fill.css('height', c_outline.css('height'));

    // Calculate the intersection.
    intersect(a_outline, b_outline, ab_fill);
    intersect(b_outline, c_outline, bc_fill);
    intersect(a_outline, c_outline, ac_fill);
    intersect(ab_fill, bc_fill, abc_fill);

    self.buttons['A'].p(a_outline.area());
    self.buttons['B'].p(b_outline.area());
    self.buttons['C'].p(c_outline.area());
    self.buttons['Ac'].p(s_outline.area() - a_outline.area());
    self.buttons['Bc'].p(s_outline.area() - b_outline.area());
    self.buttons['Cc'].p(s_outline.area() - c_outline.area());
    self.buttons['AB'].p(ab_fill.area());
    self.buttons['AC'].p(ac_fill.area());
    self.buttons['BC'].p(bc_fill.area());
    self.buttons['A or B'].p(
      a_outline.area() + b_outline.area() - ab_fill.area());
    self.buttons['A or C'].p(
      a_outline.area() + c_outline.area() - ac_fill.area());
    self.buttons['B or C'].p(
      b_outline.area() + c_outline.area() - bc_fill.area());
    self.buttons['ABC'].p(abc_fill.area());
    self.buttons['A or B or C'].p(
      a_outline.area() + b_outline.area() + c_outline.area() -
      ab_fill.area() - bc_fill.area() - bc_fill.area() +
      abc_fill.area());
    self.buttons['ABc'].p(a_outline.area() - ab_fill.area());
    self.buttons['AcB'].p(b_outline.area() - ab_fill.area());
    self.buttons['AcBC'].p(bc_fill.area() - abc_fill.area());
    self.buttons['Ac or BC'].p(
      s_outline.area() - a_outline.area() + abc_fill.area());
    self.buttons['S'].p(s_outline.area());
    self.buttons['{}'].p(0);
    if (this.options.showConditional) {
      self.buttons['P(A|B)'].p(
        ab_fill.area() / b_outline.area() * s_outline.area());
      self.buttons['P(Ac|B)'].p(
        s_outline.area() - ab_fill.area() / b_outline.area() * s_outline.area());
      self.buttons['P(B|A)'].p(
        ab_fill.area() / a_outline.area() * s_outline.area());
      self.buttons['P(A|BC)'].p(
        abc_fill.area() / bc_fill.area() * s_outline.area());
      self.buttons['P(Ac|BC)'].p(
        s_outline.area() - abc_fill.area() / bc_fill.area() * s_outline.area());
      self.buttons['P(A|(B or C))'].p(
        s_outline.area() *
        (ab_fill.area() + ac_fill.area() - abc_fill.area()) /
        (b_outline.area() + c_outline.area() - bc_fill.area()));
    }
  }

  // Updates the sizes of the boxes according to their sliders.
  function updateSizes() {
    // ratio = width / height
    // area = width * height
    // width = area / height
    // width = ratio * height
    // width * width = area * ratio
    // height = area / width
    var ratio = s_outline.width() / s_outline.height();
    var s_area = s_outline.width() * s_outline.height();
    var a_p = $('#' + container_id + 'sbA').slider('value') / 100;
    var a_area = s_area * a_p;
    var a_width = Math.sqrt(a_area * ratio);
    var a_height = a_area / a_width;
    a_outline.width(a_width + 'px');
    a_outline.height(a_height + 'px');
    var b_p = $('#' + container_id + 'sbB').slider('value') / 100;
    var b_area = s_area * b_p;
    var b_width = Math.sqrt(b_area * ratio);
    var b_height = b_area / b_width;
    b_outline.width(b_width + 'px');
    b_outline.height(b_height + 'px');
    var c_p = $('#' + container_id + 'sbC').slider('value') / 100;
    var c_area = s_area * c_p;
    var c_width = Math.sqrt(c_area * ratio);
    var c_height = c_area / c_width;
    c_outline.width(c_width + 'px');
    c_outline.height(c_height + 'px');
    syncPositions();
  }

  function draw() {
    // Initial sizes. These will get overwritten as soon as updateSizes is
    // called.
    var scaleFactorX = 0.3;
    var scaleFactorY = 0.3;

    s_outline = createBox().addClass('S');
    s_outline.css('left', '10px');
    s_outline.css('top', '10px');
    s_outline.css('width', (self.container.width() - 20) + 'px');
    s_outline.css('height', (self.container.height() - 20) + 'px');
    s_outline.text('S');
    self.container.append(s_outline);

    a_fill = createBox().addClass('A').addClass('fill');
    a_outline = createBox().addClass('A').addClass('outline');
    a_outline.css('left', (self.container.width() * 0.15) + 'px');
    a_outline.css('top', (self.container.height() * 0.3) + 'px');
    a_outline.css('width', (s_outline.width() * scaleFactorX) + 'px');
    a_outline.css('height', (s_outline.height() * scaleFactorY) + 'px');
    a_outline.text('A');

    b_fill = createBox().addClass('B').addClass('fill');
    b_outline = createBox().addClass('B').addClass('outline');
    b_outline.css('left', (self.container.width() * 0.5) + 'px');
    b_outline.css('top', (self.container.height() * 0.4) + 'px');
    b_outline.css('width', (s_outline.width() * scaleFactorX) + 'px');
    b_outline.css('height', (s_outline.height() * scaleFactorY) + 'px');
    b_outline.text('B');

    c_fill = createBox().addClass('C').addClass('fill');
    c_outline = createBox().addClass('C').addClass('outline');
    c_outline.css('left', (self.container.width() * 0.4) + 'px');
    c_outline.css('top', (self.container.height() * 0.2) + 'px');
    c_outline.css('width', (s_outline.width() * scaleFactorX) + 'px');
    c_outline.css('height', (s_outline.height() * scaleFactorY) + 'px');
    c_outline.text('C');

    ab_fill = createBox().addClass('AB').addClass('fill');
    ac_fill = createBox().addClass('AC').addClass('fill');
    bc_fill = createBox().addClass('BC').addClass('fill');
    abc_fill = createBox().addClass('BC').addClass('fill');
    self.container.append(a_fill);
    self.container.append(b_fill);
    self.container.append(c_fill);
    self.container.append(ab_fill);
    self.container.append(ac_fill);
    self.container.append(bc_fill);
    self.container.append(abc_fill);
    self.container.append(a_outline);
    self.container.append(b_outline);
    self.container.append(c_outline);
    a_outline.draggable({
      containment: s_outline,
      drag: syncPositions,
      stop: syncPositions
    });
    b_outline.draggable({
      containment: s_outline,
      drag: syncPositions,
      stop: syncPositions
    });
    c_outline.draggable({
      containment: s_outline,
      drag: syncPositions,
      stop: syncPositions
    });
  }
}
