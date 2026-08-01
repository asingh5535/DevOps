package connector

import "fmt"

type Factory func(cfg ClusterConfig) (Connector, error)

type registration struct {
	info    TypeInfo
	factory Factory
	metrics []MetricSpec
}

var registry = map[Type]registration{}

// Register is called from each connector subpackage's init() to plug itself
// into the registry, so the API layer never needs a type switch over the 7 systems.
func Register(info TypeInfo, metrics []MetricSpec, factory Factory) {
	registry[info.Type] = registration{info: info, factory: factory, metrics: metrics}
}

func Build(cfg ClusterConfig) (Connector, error) {
	reg, ok := registry[cfg.Type]
	if !ok {
		return nil, fmt.Errorf("unknown connector type: %s", cfg.Type)
	}
	return reg.factory(cfg)
}

func ListTypes() []TypeInfo {
	infos := make([]TypeInfo, 0, len(registry))
	for _, reg := range registry {
		infos = append(infos, reg.info)
	}
	return infos
}

func MetricsFor(t Type) ([]MetricSpec, error) {
	reg, ok := registry[t]
	if !ok {
		return nil, fmt.Errorf("unknown connector type: %s", t)
	}
	return reg.metrics, nil
}
