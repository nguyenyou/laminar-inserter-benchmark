package perf

import com.raquo.laminar.api.L._
import com.raquo.laminar.inserters.Inserter
import perf.Scenarios._

/** Scenarios that need the nested-inserter feature (items of `children <--` that are
  * themselves inserters), so they only compile against Laminar master.
  */
object ExtraScenarios {

  val all: Map[String, Render] = Map(
    // Nested inserter as the list item: `child <--` yielding the widget element (built once).
    "item-child-val" -> { sig =>
      div(children <-- sig.split(_.id)((_, init, s) => child <-- Val(div(widgetBindings(s), span(init.label)))))
    },
    // Nested inserter as the list item, re-rendering the element when the label changes.
    "item-child-map" -> { sig =>
      div(children <-- sig.split(_.id)((_, _, s) => child <-- s.map(_.label).distinct.map(l => div(widgetBindings(s), span(l)))))
    },
    // Nested `children <--` as the list item: a multi-node widget without a wrapper element.
    "item-children-val" -> { sig =>
      div(children <-- sig.split(_.id)((_, init, s) => children <-- Val(List(div(widgetBindings(s), span(init.label)), span("handle")))))
    },
    // Static node Seq as the list item: multi-node widget, no dynamic machinery of its own.
    "item-static-seq" -> { sig =>
      div(children <-- sig.split(_.id) { (_, init, s) =>
        val item: Inserter = List(div(widgetBindings(s), span(init.label)), span("handle"))
        item
      })
    },
    // Multi-binding leaf rendered as a nested `child <--` item instead of a wrapper div.
    "item-builder-leaf" -> { sig =>
      div(children <-- sig.split(_.id)((_, _, s) => child <-- Val(builderLeaf(s))))
    }
  )
}
