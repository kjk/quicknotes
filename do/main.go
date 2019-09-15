package main

import (
	"flag"
	"fmt"
)

var (
	flgRun bool
)

func parseFlags() {
	flag.BoolVar(&flgRun, "run", false, "run the server locally")
	flag.Parse()
}

func doRun() {
	fmt.Printf("doRun() NYI\n")
}

func main() {
	parseFlags()
	if flgRun {
		doRun()
		return
	}

	flag.Usage()
}
