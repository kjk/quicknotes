package main

const (
	cr = 0xd
	lf = 0xa
)

// LinesInfo contains information about where the lines start in a piece of text
type LinesInfo struct {
	// start position of nth line, with a fake entry for last+1 line
	Pos []int
}

// LineCount returns number of lines
func (i *LinesInfo) LineCount() int {
	return len(i.Pos) - 1
}

func isNewline(c byte) bool {
	switch c {
	case '\r', '\n':
		return true
	default:
		return false
	}
}

// PosLen return position and length of 0-based lineNo
// length includes newline characters at the end
// we don't validate lineNo
func (i *LinesInfo) PosLen(lineNo int) (int, int) {
	start := i.Pos[lineNo]
	end := i.Pos[lineNo+1]
	return start, end - start
}

// newlines are: cr, lf or cr+lf
func nextLine(d []byte) int {
	for i, c := range d {
		if c == lf {
			return i + 1
		}
		if c == cr {
			if len(d) == i+1 {
				return i + 1
			}
			next := d[i+1]
			if next == lf {
				return i + 2
			}
			return i + 1
		}
	}
	return len(d)
}

func detectLines(d []byte) *LinesInfo {
	res := &LinesInfo{
		Pos: []int{0},
	}
	lineStart := 0
	for len(d) > 0 {
		len := nextLine(d)
		lineStart += len
		res.Pos = append(res.Pos, lineStart)
		d = d[len:]
	}
	return res
}
