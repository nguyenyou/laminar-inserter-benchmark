package perf

import com.raquo.laminar.api.L._
import org.scalajs.dom
import scala.scalajs.js
import scala.scalajs.js.annotation.JSExportTopLevel

/** Browser-only synchronous workload. The runner collects garbage outside timed operations. */
object Bench {
  private var items: Option[Var[List[Scenarios.Widget]]] = None
  private var root: Option[RootNode] = None
  private var container: Option[dom.Element] = None

  def timed(body: => Unit): Double = {
    val start = dom.window.performance.now()
    body
    dom.window.performance.now() - start
  }

  @JSExportTopLevel("installBench")
  def install(): Unit = {
    val api = js.Dynamic.literal()
    api.mount = { (scenario: String, n: Int) =>
      val host = dom.document.createElement("div")
      dom.document.body.appendChild(host)
      container = Some(host)
      val state = Var(Scenarios.widgets(n, 0))
      items = Some(state)
      val scenarioRender = (Scenarios.all ++ ExtraScenarios.all)(scenario)
      timed { root = Some(render(host, scenarioRender(state.signal))) }
    }: js.Function2[String, Int, Double]
    api.update = { (operation: String, n: Int) =>
      val state = items.get
      timed {
        operation match {
          case "reemit" => state.update(identity)
          case "update-all" => state.set(Scenarios.widgets(n, 1))
          case "update-one" => state.update(xs => xs.updated(n / 2, xs(n / 2).copy(label = "changed")))
          case "select-one" => state.update(xs => xs.updated(3, xs(3).copy(selected = true)))
          case "append" => state.update(xs => xs :+ Scenarios.widgets(1, 0).head.copy(id = n))
          case "prepend" => state.update(xs => Scenarios.widgets(1, 0).head.copy(id = -1) :: xs)
          case "remove-mid" => state.update(_.patch(n / 2, Nil, 1))
          case "reverse" => state.update(_.reverse)
          case _ => throw new IllegalArgumentException(operation)
        }
      }
    }: js.Function2[String, Int, Double]
    api.unmount = { () => timed { root.get.unmount() } }: js.Function0[Double]
    api.dispose = { () =>
      root = None
      items = None
      container.foreach(_.remove())
      container = None
    }: js.Function0[Unit]
    js.Dynamic.global.updateDynamic("bench")(api)
  }

  def main(args: Array[String]): Unit = install()
}
