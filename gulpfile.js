// Pre-requisites: need to install all the npm modules with:
// npm install

// TODO:
// - use gulp-uglify for prod to minifiy javascript:
//   var uglify= require('gulp-uglify');
//   .pipe(uglify())

var babelify = require("babelify");
var browserify = require('browserify');
var exorcist = require('exorcist');
var gulp = require('gulp');
var prefix = require('gulp-autoprefixer');
var rename = require('gulp-rename');
var sass = require('gulp-sass');
var sourcemaps = require('gulp-sourcemaps');
var uglify = require('gulp-uglify');
var source = require('vinyl-source-stream');

gulp.task('copy_css1', function() {
  return gulp.src("./node_modules/codemirror/lib/codemirror.css")
    .pipe(rename('codemirror.scss'))
    .pipe(gulp.dest("./sass"));
})

gulp.task('copy_css2', function() {
  return gulp.src("./node_modules/codemirror/theme/solarized.css")
    .pipe(rename('solarized.scss'))
    .pipe(gulp.dest("./sass"));
})

gulp.task('js', function() {
  browserify({
    entries: ['jsx/App.jsx'],
    debug: true
  })
    .transform('babelify', {
      presets: ['es2015', 'react']
    })
    .bundle()
    .pipe(exorcist('s/dist/bundle.js.map'))
    .pipe(source('bundle.js'))
    .pipe(gulp.dest('s/dist'));
});

gulp.task('css', ['copy_css1', 'copy_css2'], function() {
  return gulp.src('./sass/main.scss')
    .pipe(sourcemaps.init())
    .pipe(sass().on('error', sass.logError))
    .pipe(prefix('last 2 versions'))
    .pipe(sourcemaps.write('.')) // this is relative to gulp.dest()
    .pipe(gulp.dest('./s/dist/'));
});

gulp.task('watch', function() {
  gulp.watch('jsx/*', ['js']);
  gulp.watch('./sass/**/*', ['css']);
});

gulp.task('default', ['css', 'js']);

gulp.task('build_and_watch', ['default', 'watch']);
