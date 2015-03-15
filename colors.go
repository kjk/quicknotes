package main

import "fmt"

var (
	// those are slack colors
	cssColors = []string{
		"#e85d72",
		"#df3dc0",
		"#dd8527",
		"#dc7dbb",
		"#bc3663",
		"#a72f79",
		"#a63024",
		"#9f69e7",
		"#9e3997",
		"#9d8eee",
		"#9b3b45",
		"#84b22f",
		"#73769d",
		"#684b6c",
		"#674b1b",
		"#619a4f",
		"#5b89d5",
		"#5a4592",
		"#4ec0d6",
		"#4d5e26",
		"#4bbe2e",
		"#3c989f",
	}
	nCssColors      = len(cssColors)
	colorsCssString string
)

func init() {
	colorsCssString = buildColorCss()
}

func buildColorCss() string {
	s := ""
	for i, col := range cssColors {
		s += fmt.Sprintf(".tcol%d { color: %s; }\n  ", i, col)
	}
	return s
}
