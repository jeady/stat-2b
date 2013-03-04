module.exports = function(grunt) {
  grunt.loadNpmTasks('grunt-css');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-uglify');

  // Project configuration.
  grunt.initConfig({
    jshint: {
      options: {
        sub: false,
      },
      files: ['grunt.js', 'lib/*.js'],
    },
    csslint: {
      css: 'lib/*.css'
    },
    concat: {
      js: {
        src: ['lib/*.js', 'vendor/**/*.js'],
        dest: 'sticigui.js'
      },
      css: {
        src: ['lib/*.css', 'vendor/**/*.css'],
        dest: 'sticigui.css'
      }
    },
    uglify: {
      options: {
        mangle: {
          except: ['jQuery', 'd3']
        }
      },
      js: {
        files: {
          'sticigui.min.js' : ['sticigui.js']
        }
      }
    },
    cssmin: {
      css: {
        src: 'sticigui.css',
        dest: 'sticigui.css'
      }
    }
  });

  // Currently we cannot use csslint because we depend on using SVG CSS
  // properties such as 'fill' and 'stroke'. When csslint eventually supports
  // SVG CSS properties (i.e. https://github.com/nzakas/parser-lib/issues/28 is
  // closed), we should add csslint to the list of tasks to perform.
  // TODO(jmeady): add csslint.
  grunt.registerTask('default', ['jshint', 'concat', 'uglify', 'cssmin']);
  grunt.registerTask('debug', ['jshint', 'concat']);

};
