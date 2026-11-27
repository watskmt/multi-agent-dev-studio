import html


def render_order(name, note):
    return f"<div><h2>{html.escape(name)}</h2><p>{note}</p></div>"
