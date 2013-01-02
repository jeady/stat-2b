What Is This?
=============
The GitHub repo containing the open source utilities used to render the
interactive content for UC Berkeley's Stat 2B course. Demos may be found
[here](http://jeady.github.com/stat-2b).

Currently the following interactive charts are supported:

1. Histogram
   Created by invoking `Stici_HistHiLite`.

Usage
=====
You may find a compiled copy of this library
[here](https://raw.github.com/jeady/stat-2b/gh-pages/sticigui.js). If you wish
to build your own copy of sticigui.js, see the section on development. To use
this library, you will need to link to both sticigui.js and sticigui.css from
your web application. Additionally, the following dependancies are required:

1. jQuery
2. jQuery UI
3. d3
4. PopBox

All interactive charts in this library are used by invoking the creation method
with the ID of the container object as the first parameter and options as the
second parameter. For options, see the source files in lib/.
For example:

    <div id="chart">
    </div>

    <script>
    jQuery(function() {
      Stici_HistHiLite('chart', {
        data: ['../../data/gmat.json']
      });
    });
    </script>

Data Format
===========
This library expects input data to be a JSON-encoded array of arrays, where
data[0] is an array of field names and data[1..n] contains the actual data.
For example:
    [['Student ID', 'Grade'],
     [1, 95],
     [8, 75],
     [3, 90]]

Browser Support
===============
Currently only Safari and Chrome on OS X have been tested to work. Firefox and
Internet Explorer support are in development.

Development
===========
This library is compiled using Grunt. To compile sticigui.js, simple run
`grunt` from this project's directory. You can start up a development webserver
that hosts the demo files by running `python -m SimpleHTTPServer` from the
project's directory, and then navigating to any of the .html files in the html/
directory.
