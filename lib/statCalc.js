/*
This file contains two functions:
    statCalc: a simple calculator
    distCalc: a calculator probability distributions

copyright (c) 2013 by P.B. Stark
last modified 27 January 2013.

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
    See the GNU Affero Public License for more details.
    http://www.gnu.org/licenses/

Dependencies: irGrade, jQuery, jQuery-ui

*/

function statCalc(container_id, params) {
    var self = this;
    this.container = $('#' + container_id);

    if (!params instanceof Object) {
       console.error('statCalc parameters should be an object');
       return;
    }

// default options
    this.options = {
                    keys: [ [["7","num"],["8","num"],["9","num"],["/","bin"], ["nCk","bin"]],
                            [["4","num"],["5","num"],["6","num"],["*","bin"], ["nPk","bin"]],
                            [["1","num"],["2","num"],["3","num"],["-","bin"], ["!","una"]],
                            [["0","num"],[".","num"],["+/-","una"],["+","bin"], ["1/x","una"]],
                            [["=","eq"],  ["CE","una"],  ["C","una"], ["Sqrt","una"], ["x^2","una"]]
                          ],
                    buttonsPerRow: 5,
/*      Full set of keys:
                    keys: [ [["7","num"],["8","num"],["9","num"],["/","bin"], ["nCk","bin"], ["nPk","bin"]],
                            [["4","num"],["5","num"],["6","num"],["*","bin"], ["!","una"], ["U[0,1]","una"]],
                            [["1","num"],["2","num"],["3","num"],["-","bin"], ["Sqrt","una"], ["x^2","una"]],
                            [["0","num"],[".","num"],["+/-","una"],["+","bin"], ["1/x","una"], ["x^y","bin"]],
                            [["=","eq"],  ["CE","una"],  ["C","una"], ["exp(x)","una"], ["log(x)","una"],  ["log_y(x)", "bin"]]
                          ],
                    buttonsPerRow: 6
*/
                    digits: 16
    };

// Extend options
    $.extend(this.options, params);

    self.x = 0.0;
    self.inProgress = false;
    self.currentOp = null;

    function initCalc() {
        var me = $('<div />').addClass('calc');
        self.container.append(me);
        // display
        self.theDisplay = $('<input type="text" />').attr('size',self.options.digits);
        me.append(self.theDisplay);
        // buttons
        self.buttonDiv = $('<div />').addClass('buttonDiv');
        self.numButtonDiv = $('<div />').addClass('numButtonDiv');
        self.fnButtonDiv = $('<div />').addClass('fnButtonDiv');
        self.numButtonTable = $('<table />').addClass('numButtonTable');
        self.fnButtonTable = $('<table />').addClass('fnButtonTable');
        self.numButtonDiv.append(self.numButtonTable);
        self.fnButtonDiv.append(self.fnButtonTable);
        self.buttonDiv.append(self.numButtonDiv);
        self.buttonDiv.append(self.fnButtonDiv);
        $.each(self.options.keys, function(j, rowKeys) {
          var row = $('<tr>');
          self.numButtonTable.append(row);
          $.each(rowKeys, function(i, v) {
            if (null === v) {
              row.append($('<td/>'));
              return;
            }
            newBut = $('<input type="button" value="' + v[0] + '">')
              .button()
              .addClass(v[1])
              .addClass('calcButton')
              .click( function() {buttonClick(v[0], v[1]);});
            row.append($('<td/>').append(newBut));
          });
        });
        me.append(self.buttonDiv);
    }
    initCalc();

//  action functions

    function buttonClick(v, opType) {
        var t = self.theDisplay.val().replace(/[^0-9e.\-]+/gi,'').replace(/^0+/,'');
        try {
            switch(opType) {
               case 'num':
                   self.theDisplay.val(t+v);
                   break;

               case 'una':
                   switch(v) {
                      case '+/-':
                         t = (t.indexOf('-') === 0) ? t.substring(1) : '-'+t;
                         self.theDisplay.val(t);
                         break;
                      case '!':
                         self.theDisplay.val(factorial(t).toString());
                         break;
                      case 'Sqrt':
                         self.theDisplay.val(Math.sqrt(t).toString());
                         break;
                      case 'x^2':
                         self.theDisplay.val((t*t).toString());
                         break;
                      case 'exp(x)':
                         self.theDisplay.val(Math.exp(t).toString());
                         break;
                      case 'ln(x)':
                         self.theDisplay.val(Math.log(t).toString());
                         break;
                      case '1/x':
                         self.theDisplay.val((1/t).toString());
                         break;
                      case 'U[0,1]':
                         self.theDisplay.val(rand.next());
                         break;
                      case 'N(0,1)':
                         self.theDisplay.val(rNorm());
                         break;
                      case 'CE':
                         self.theDisplay.val('0');
                         break;
                      case 'C':
                         self.x = 0;
                         self.inProgress = false;
                         self.currentOp = null;
                         self.theDisplay.val('0');
                    }
                    break;

               case 'bin':
                   if (self.inProgress) {
                        self.x = doBinaryOp(self.x, self.currentOp, t);
                        self.theDisplay.val(self.x.toString());
                   } else {
                        self.x = t;
                        self.theDisplay.val('?');
                        self.inProgress = true;
                   }
                   self.currentOp = v;
                   break;

               case 'eq':
                   if (self.inProgress) {
                        self.x = doBinaryOp(self.x, self.currentOp, t);
                        self.theDisplay.val(self.x.toString());
                        self.inProgress = false;
                        self.currentOp = null;
                   }
                   break;

               default:
                   console.log('unexpected button in statCalc ' + v);
            }
        } catch(e) {
           console.log(e);
           self.theDisplay.val('NaN');
        }
    }

    function doBinaryOp(x, op, y) {
         var res = Math.NaN;
         try {
             switch(op) {
                 case '+':
                     res = parseFloat(x)+parseFloat(y);
                     break;
                 case '-':
                     res = parseFloat(x)-parseFloat(y);
                     break;
                 case '*':
                     res = parseFloat(x)*parseFloat(y);
                     break;
                 case '/':
                     res = parseFloat(x)/parseFloat(y);
                     break;
                 case 'x^y':
                     res = parseFloat(x)^parseFloat(y);
                     break;
                 case 'nCk':
                     res = binomialCoef(parseFloat(x), parseFloat(y));
                     break;
                 case 'nPk':
                     res = permutations(parseFloat(x), parseFloat(y));
                     break;
                 default:
                     console.log('unexpected binary function in statCalc ' + op);
              }
        } catch(e) {
        }
        return(res);
    }




}

function distCalc(container_id, params) {
    var self = this;
    this.container = $('#' + container_id);

    if (!params instanceof Object) {
       console.error('distCalc parameters should be an object');
       return;
    }

// default options
    this.options = {
                    distributions: [ ["Binomial", ["n","p"]],
                                     ["Geometric", ["p"]],
                                     ["Negative Binomial", ["p","r"]],
                                     ["Hypergeometric",["N","G","n"]],
                                     ["Normal", ["mean","SD"]],
                                     ["Student t", ["degrees of freedom"]],
                                     ["Chi-square", ["degrees of freedom"]],
                                     ["Exponential", ["mean"]],
                                     ["Poisson", ["mean"]]
                                   ],
                    digits: 8,
                    paramDigits: 4,
                    showExpect: true
    };

// Extend options
    $.extend(this.options, params);

    self.lo = 0.0;
    self.hi = 0.0;
    self.currDist = null;
    self.distDivs = [];

    function init() {
        var me = $('<div />').addClass('distCalc');
        self.container.append(me);

        // distribution selection
        self.selectDiv = $('<div />').addClass('selectDiv').append('If X has a ');
        self.selectDist = $('<select />').change(function() {
              changeDist($(this).val());
        });

        // parameters of the distributions
        $.each(self.options.distributions, function(i, v) {
               $('<option/>', { value : v[0] }).text(v[0]).appendTo(self.selectDist);
               self.distDivs[v[0]] = $('<div />').css('display','inline');
               $.each(v[1], function(j, parm) {
                     self.distDivs[v[0]].append(parm + ' = ')
                                        .append(  $('<input type="text" />')
                                                    .attr('size','paramDigits')
                                                    .addClass(parm.replace(/ +/g,'_'))
                                                    .blur(calcProb)
                                        )
                                        .append(', ');
               });
        });

        self.paramSpan = $('<span />').addClass('paramSpan');
        self.selectDiv.append(self.selectDist)
                      .append('distribution with ')
                      .append(self.paramSpan);

        // start with the first listed distribution
        self.currDist = self.options.distributions[0][0];
        self.paramSpan.append(self.distDivs[self.currDist]);

        // range over which to find the probability
        self.selectDiv.append(' the chance that ')
                      .append($('<input type="checkbox">').addClass('useLower').click(calcProb))
                      .append('X &ge;')
                      .append($('<input type="text" />').addClass('loLim').attr('size',self.options.digits).val("0").blur(calcProb))
                      .append($('<input type="checkbox">').addClass('useUpper').click(calcProb))
                      .append('and X &le;')
                      .append($('<input type="text" />').addClass('hiLim').attr('size',self.options.digits).val("0").blur(calcProb))
                      .append(' is ');

        // display
        self.theDisplay = $('<input type="text" readonly />').attr('size',self.options.digits+4);
        self.expectSpan = $('<span />').addClass('expectSpan');
        self.selectDiv.append(self.theDisplay).append(self.expectSpan);
        me.append(self.selectDiv);
    }
    init();

//  action functions

    function changeDist(dist) {
        self.currDist = dist;
        self.paramSpan.empty();
        self.expectSpan.empty();
        var thisDist = $.grep(self.options.distributions, function(v,i) {
                          return(v[0] === dist);
        });
        self.paramSpan.append(self.distDivs[thisDist[0][0]]);  // replace with parameters for current distribution
        self.theDisplay.val('NaN');
        calcProb();
    }

    function calcProb() {
        var prob  = Number.NaN;

        // get range over which to compute the probability
        var loCk  = self.selectDiv.find('.useLower').prop('checked');
        var loLim = loCk ? parseFloat(self.selectDiv.find('.loLim').val()) : Number.NaN;
        var hiCk  = self.selectDiv.find('.useUpper').prop('checked');
        var hiLim = hiCk ? parseFloat(self.selectDiv.find('.hiLim').val()) : Number.NaN;

        var allParamsDefined = true;
        $.each(self.distDivs[self.currDist].find(':input'), function(i, v) {
               if (v.value.trim().length === 0) {
                   allParamsDefined = false;
               }
        });

        if ((!loCk && !hiCk) || !allParamsDefined) {
              prob = Number.NaN;
        } else if (loCk && hiCk && (loLim > hiLim)) {
              prob = 0.0;
        } else {
              self.expectSpan.empty();
              var n;
              var p;
              var t;
              var b;
              var df;
              var m;
              switch(self.currDist) {
                   case "Binomial":
                      n = parseFloat(self.distDivs[self.currDist].find('.n').val());
                      p = parsePercent(self.distDivs[self.currDist].find('.p').val());
                      t = hiCk ? binomialCdf(n, p, hiLim) : 1.0;
                      b = loCk ? binomialCdf(n, p, loLim-1) : 0.0;
                      prob = t - b;
                      if (self.options.showExpect) {
                          self.expectSpan.append('E(X) = ' + (n*p).toFixed(self.options.paramDigits) +
                                                 '; SE(X) = ' + Math.sqrt(n*p*(1-p)).toFixed(self.options.paramDigits));
                      }
                      break;

                   case "Geometric":
                      p = parsePercent(self.distDivs[self.currDist].find('.p').val());
                      t = hiCk ? geoCdf(p, hiLim) : 1.0;
                      b = loCk ? geoCdf(p, loLim-1) : 0.0;
                      if (self.options.showExpect) {
                           self.expectSpan.append('E(X) = ' + (1/p).toFixed(self.options.paramDigits) +
                                                  '; SE(X) = ' + (Math.sqrt(1-p)/p).toFixed(self.options.paramDigits));
                      }
                      prob = t - b;
                      break;

                   case "Negative Binomial":
                      p = parsePercent(self.distDivs[self.currDist].find('.p').val());
                      r = parseFloat(self.distDivs[self.currDist].find('.r').val());
                      t = hiCk ? negBinomialCdf( p,  r, hiLim) : 1.0;
                      b = loCk ? negBinomialCdf( p,  r, loLim-1) : 0.0;
                      prob = t - b;
                      if (self.options.showExpect) {
                          self.expectSpan.append('E(X) = ' + (r/p).toFixed(self.options.paramDigits) +
                                                 '; SE(X) = ' + (Math.sqrt(r*(1-p))/p).toFixed(self.options.paramDigits));
                      }
                      break;

                   case "Hypergeometric":
                      var N = parseFloat(self.distDivs[self.currDist].find('.N').val());
                      var G = parseFloat(self.distDivs[self.currDist].find('.G').val());
                      n = parseFloat(self.distDivs[self.currDist].find('.n').val());
                      t = hiCk ? hyperGeoCdf(N,  G, n, hiLim) : 1.0;
                      b = loCk ? hyperGeoCdf(N,  G, n, loLim-1) : 0.0;
                      prob = t - b;
                      var hyP = G/N;
                      if (self.options.showExpect) {
                           self.expectSpan.append('E(X) = ' + (n*hyP).toFixed(self.options.paramDigits) +
                                                  '; SE(X) = ' + (Math.sqrt(n*hyP*(1-hyP)*(N-n)/(N-1))).toFixed(self.options.paramDigits));
                      }
                      break;

                   case "Normal":
                      m = parseFloat(self.distDivs[self.currDist].find('.mean').val());
                      var s = parseFloat(self.distDivs[self.currDist].find('.SD').val());
                      t = hiCk ? normCdf((hiLim-m)/s) : 1.0;
                      b = loCk ? normCdf((loLim-m)/s) : 0.0;
                      prob = t - b;
                      if (self.options.showExpect) {
                           self.expectSpan.append('E(X) = ' + m.toFixed(self.options.paramDigits) +
                                                  '; SE(X) = ' + s.toFixed(self.options.paramDigits));
                      }
                      break;

                   case "Student t":
                      df = parseFloat(self.distDivs[self.currDist].find('.degrees_of_freedom').val());
                      t = hiCk ? tCdf(df, hiLim) : 1.0;
                      b = loCk ? tCdf(df, loLim) : 0.0;
                      prob = t - b;
                      var se = (df > 2) ? (Math.sqrt(df/(df-2))).toFixed(self.options.paramDigits) : Number.NaN;
                      if (self.options.showExpect) {
                           self.expectSpan.append('E(X) = 0; SE(X) = ' + se);
                      }
                      break;

                   case "Chi-square":
                      df = parseFloat(self.distDivs[self.currDist].find('.degrees_of_freedom').val());
                      t = hiCk ? chi2Cdf(df, hiLim) : 1.0;
                      b = loCk ? chi2Cdf(df, loLim) : 0.0;
                      if (self.options.showExpect) {
                           self.expectSpan.append('E(X) = ' + df.toFixed(self.options.paramDigits) +
                                                  '; SE(X) = ' + (Math.sqrt(2*df)).toFixed(self.options.paramDigits));
                      }
                      prob = t - b;
                      break;

                   case "Exponential":
                      m = parseFloat(self.distDivs[self.currDist].find('.mean').val());
                      t = hiCk ? expCdf(m, hiLim) : 1.0;
                      b = loCk ? expCdf(m, loLim) : 0.0;
                      prob = t - b;
                      if (self.options.showExpect) {
                           self.expectSpan.append('E(X) = ' + m.toFixed(self.options.paramDigits) +
                                                  '; SE(X) = ' + m.toFixed(self.options.paramDigits));
                      }
                      break;

                   case "Poisson":
                      m = parseFloat(self.distDivs[self.currDist].find('.mean').val());
                      t = hiCk ? poissonCdf(m, hiLim) : 1.0;
                      b = loCk ? poissonCdf(m, loLim) : 0.0;
                      prob = t - b;
                      if (self.options.showExpect) {
                           self.expectSpan.append('E(X) = ' + m.toFixed(self.options.paramDigits) +
                                                  '; SE(X) = ' + (Math.sqrt(m)).toFixed(self.options.paramDigits));
                      }
                      break;

                   default:
                      console.log('unexpected distribution in distCalc.calcProb ' + dist);
              }
        }
        self.theDisplay.val((100*prob).toFixed(self.options.digits-3)+'%');
    }

}
