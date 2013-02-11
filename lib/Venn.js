function Venn(container_id) {
  var self = this;

  this.env = jQuery('#' + container_id);
  var app = jQuery('<div/>',{id:container_id + 'app'}).addClass('stici_venn');
  this.env.append(app);

  this.container = jQuery('<div/>',{id:container_id + 'container'}).addClass('container');
  this.container.css('width',(this.env.width() - 160) + 'px');
  this.container.css('height', (this.env.height() - 60) + 'px');
  var buttons = jQuery('<div/>',{id:container_id + 'buttons'}).addClass('buttons');
  var scrollbars = jQuery('<div/>',{id:container_id + 'scrollbars'}).addClass('scrollbars');

  app.append(self.container);
  app.append(buttons);
  app.append(scrollbars);

  var s_outline, a_outline, b_outline;
  var a_fill, b_fill, ab_fill;

  var button_args = [
    ['A', function () {
      a_fill.addClass('selected');
    }],

    ['Ac', function () {
      s_outline.addClass('selected');
      a_fill.addClass('opaque');
    }],

    ['B', function () {
      b_fill.addClass('selected');
    }],

    ['Bc', function () {
      s_outline.addClass('selected');
      b_fill.addClass('opaque');
    }],

    ['A or B', function () {
      a_fill.addClass('selected');
      b_fill.addClass('selected');
    }],

    ['AB', function () {
      ab_fill.addClass('selected');
    }],

    ['ABc', function () {
      a_fill.addClass('selected');
      ab_fill.addClass('opaque');
    }],

    ['AcB', function () {
      b_fill.addClass('selected');
      ab_fill.addClass('opaque');
    }],

    ['S', function () {
      s_outline.addClass('selected');
    }],

    ['{}', function () {
    }]
  ];
  $.each(button_args, function(i, button_arg) {
    var button_name = button_arg[0];
    var button_action = button_arg[1];
    var button = jQuery('<div/>').addClass('button');
    buttons.append(button);
    var inp = jQuery('<input/>',{type:'radio',name:'buttons'});
    var label = jQuery('<label/>').click(function() {inp.prop('checked', true);});
    button.click(function() {
      inp.prop('checked', true);
      a_outline.removeClass('selected opaque');
      b_outline.removeClass('selected opaque');
      a_fill.removeClass('selected opaque');
      b_fill.removeClass('selected opaque');
      ab_fill.removeClass('selected opaque');
      s_outline.removeClass('selected opaque');
      button_action();
    });
    label.html(button_name);
    button.append(inp);
    button.append(label);
  });
  function createPercentControl(letter) {
    var sb = jQuery('<div/>',{id:container_id + 'psb' + letter}).addClass('scrollbar');
    var lbl = jQuery('<label/>').attr('for', container_id + 'sb'+letter);
    lbl.html('P(' + letter + ') (%)');
    var idFunc1 = "$('#" + container_id + "sb" + letter + "').val(this.value)";
    var idFunc2 = "$('#" + container_id + "sb" + letter + "t').val(this.value)";
    var input = jQuery('<input/>', {
      type: 'text',
      id: container_id + 'sb'+letter+'t',
      onkeyup: idFunc1,
      value: 30,
      size: 2
    });
    var input2 = jQuery('<input/>', {
      type: 'range',
      id: container_id + 'sb'+letter,
      onchange: idFunc2,
      min: 1,
      max: 100,
      step: 1,
      value: 30,
      style: 'width: 92px'
    });

    sb.append(lbl);
    sb.append(input);
    sb.append(input2);

    scrollbars.append(sb);
  }
  createPercentControl('A');
  createPercentControl('B');

  var scaleFactorX = 0.3;
  var scaleFactorY = 0.3;

  // Synchronizes fill positions so that the outline is always visible on the A
  // and B boxes, and the intersection area is synchronized.
  function syncPositions() {
    // Make sure everything stays in bounds.
    var ax_offset = a_outline.offset().left + a_outline.width() -
      (a_outline.parent().offset().left + a_outline.parent().width());
    if (ax_offset > 0)
      a_outline.css('left', (a_outline.position().left - ax_offset) + 'px');
    var ay_offset = a_outline.offset().top + a_outline.height() -
      (a_outline.parent().offset().top + a_outline.parent().height());
    if (ay_offset > 0)
      a_outline.css('top', (a_outline.position().top - ay_offset) + 'px');
    var bx_offset = b_outline.offset().left + b_outline.width() -
      (b_outline.parent().offset().left + b_outline.parent().width());
    if (bx_offset > 0)
      b_outline.css('left', (b_outline.position().left - bx_offset) + 'px');
    var by_offset = b_outline.offset().top + b_outline.height() -
      (b_outline.parent().offset().top + b_outline.parent().height());
    if (by_offset > 0)
      b_outline.css('top', (b_outline.position().top - by_offset) + 'px');

    // Synchronize the fills with the outlines.
    a_fill.css('left', a_outline.css('left'));
    a_fill.css('top', a_outline.css('top'));
    a_fill.css('width', a_outline.css('width'));
    a_fill.css('height', a_outline.css('height'));

    b_fill.css('left', b_outline.css('left'));
    b_fill.css('top', b_outline.css('top'));
    b_fill.css('width', b_outline.css('width'));
    b_fill.css('height', b_outline.css('height'));

    // Calculate the intersection.
    var a_x = a_outline.position().left;
    var a_y = a_outline.position().top;
    var a_w = a_outline.width();
    var a_h = a_outline.height();
    var b_x = b_outline.position().left;
    var b_y = b_outline.position().top;
    var b_w = b_outline.width();
    var b_h = b_outline.height();
    if (a_x + a_w < b_x || b_x + b_w < a_x ||
        a_y + a_h < b_y || b_y + b_h < a_y) {
      ab_fill.css('display', 'none');
    } else {
      ab_fill.css('display', '');
      var x1 = Math.max(a_x, b_x);
      var y1 = Math.max(a_y, b_y);
      ab_fill.css('left', x1 + 'px');
      ab_fill.css('top', y1 + 'px');
      var x2 = Math.min(a_x + a_w, b_x + b_w);
      var y2 = Math.min(a_y + a_h, b_y + b_h);
      ab_fill.css('width', (x2 - x1) + 'px');
      ab_fill.css('height', (y2 - y1) + 'px');
    }
  }

  function draw() {

    s_outline = jQuery('<div/>').addClass('box').addClass('S');
    s_outline.css('left', '10px');
    s_outline.css('top', '10px');
    s_outline.css('width', (self.container.width() - 20) + 'px');
    s_outline.css('height', (self.container.height() - 20) + 'px');
    s_outline.text('S');
    self.container.append(s_outline);

    var rectX = self.container.width() / 2 - 50;
    var rectY = self.container.height() / 2 - 25;

    a_fill = jQuery('<div/>').addClass('box').addClass('A').addClass('fill');
    a_outline = jQuery('<div/>').addClass('box').addClass('A').addClass('outline');
    a_outline.css('left', (rectX - 32) + 'px');
    a_outline.css('top', (rectY - 16) + 'px');
    a_outline.css('width', (320 * scaleFactorX) + 'px');
    a_outline.css('height', (180 * scaleFactorY) + 'px');
    a_outline.text('A');

    b_fill = jQuery('<div/>').addClass('box').addClass('B').addClass('fill');
    b_outline = jQuery('<div/>').addClass('box').addClass('B').addClass('outline');
    b_outline.css('left', (rectX + 32) + 'px');
    b_outline.css('top', (rectY + 16) + 'px');
    b_outline.css('width', (320 * scaleFactorX) + 'px');
    b_outline.css('height', (180 * scaleFactorY) + 'px');
    b_outline.text('B');

    ab_fill = jQuery('<div/>').addClass('box').addClass('AB').addClass('fill');
    self.container.append(a_fill);
    self.container.append(b_fill);
    self.container.append(ab_fill);
    self.container.append(a_outline);
    self.container.append(b_outline);
    a_outline.draggable({
      containment: 'parent',
      drag: syncPositions,
      stop: syncPositions
    });
    b_outline.draggable({
      containment: 'parent',
      drag: syncPositions,
      stop: syncPositions
    });
    syncPositions();

    $('#' + container_id + 'sbA').change(function () {
      a_outline.width((320*this.value/100) + 'px');
      a_outline.height((180*this.value/100) + 'px');
      syncPositions();
    });

    $('#' + container_id + 'sbB').change(function () {
      b_outline.width((320*this.value/100) + 'px');
      b_outline.height((180*this.value/100) + 'px');
      syncPositions();
    });

    $('#' + container_id + 'sbAt').change(function () {
      a_outline.width((320*this.value/100) + 'px');
      a_outline.height((180*this.value/100) + 'px');
      syncPositions();
    });

    $('#' + container_id + 'sbBt').change(function () {
      b_outline.width((320*this.value/100) + 'px');
      b_outline.height((180*this.value/100) + 'px');
      syncPositions();
    });
  }
  draw();
}
