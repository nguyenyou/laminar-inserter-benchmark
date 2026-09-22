package perf

import com.raquo.laminar.api.L._

/** Scenarios that compile against both Laminar 18.0.0-M5 and master: the items of the
  * `children <--` list are always elements. They differ in what dynamic machinery each
  * widget element carries inside, using two generic UI shapes:
  *  - the labelled widget: one `child.text <--` per widget
  *  - the multi-binding widget: a `child <--` kind dispatch plus several `child.maybe <--`
  */
object Scenarios {

  final case class Widget(id: Int, label: String, x: Int, y: Int, w: Int, h: Int, fontSize: Int, selected: Boolean)

  def widgets(n: Int, gen: Int): List[Widget] = {
    List.tabulate(n) { i =>
      Widget(
        id = i,
        label = s"Field $i",
        x = (i * 37 + gen) % 600,
        y = (i * 53 + gen) % 800,
        w = 80 + gen,
        h = 20 + gen,
        fontSize = 10 + (gen % 4),
        selected = false
      )
    }
  }

  type Render = Signal[List[Widget]] => HtmlElement

  /** The bindings every widget element carries in the labelled widget: 4 styles + 1 class. */
  def widgetBindings(sig: Signal[Widget]): Seq[Modifier[HtmlElement]] = Seq(
    cls := "widget",
    transform <-- sig.map(w => s"translate(${w.x}px, ${w.y}px)"),
    width <-- sig.map(w => s"${w.w}px"),
    height <-- sig.map(w => s"${w.h}px"),
    fontSize <-- sig.map(w => s"${w.fontSize}px"),
    cls("selected") <-- sig.map(_.selected)
  )

  /** Multi-binding leaf: a kind dispatch and five optional overlays, mostly absent. */
  def builderLeaf(sig: Signal[Widget]): HtmlElement = {
    val selectedSignal = sig.map(_.selected).distinct
    div(
      widgetBindings(sig),
      child <-- sig.map(_.id % 3).distinct.map { kind => if (kind == 0) input() else if (kind == 1) textArea() else span("static") },
      child.maybe <-- selectedSignal.map(s => Option.when(s)(span("action"))),
      child.maybe <-- selectedSignal.map(s => Option.when(s)(span("rule"))),
      child.maybe <-- sig.map(_.label.length > 100).distinct.map(l => Option.when(l)(span("pdf"))),
      child.maybe <-- sig.map(_.label).distinct.map(l => Some(div(span(l)))),
      child.maybe <-- sig.map(_.fontSize > 100).distinct.map(l => Option.when(l)(span("formatted")))
    )
  }

  val all: Map[String, Render] = Map(
    // Baseline: split into elements, static label (no inserter inside the widget).
    "elem-static-text" -> { sig =>
      div(children <-- sig.split(_.id)((_, init, s) => div(widgetBindings(s), span(init.label))))
    },
    // labelled widget shape: split into elements, label via `child.text <--` inside a span.
    "elem-text-inserter" -> { sig =>
      div(children <-- sig.split(_.id)((_, _, s) => div(widgetBindings(s), span(child.text <-- s.map(_.label)))))
    },
    // Wrapper-element alternative to nested items: `child <--` inside the widget element.
    "elem-child-inserter" -> { sig =>
      div(children <-- sig.split(_.id)((_, _, s) => div(widgetBindings(s), child <-- s.map(_.label).distinct.map(l => span(l)))))
    },
    // Multi-binding widget leaf: 1 `child <--` + 5 `child.maybe <--` per widget.
    "elem-builder-leaf" -> { sig =>
      div(children <-- sig.split(_.id)((_, _, s) => builderLeaf(s)))
    }
  )
}
