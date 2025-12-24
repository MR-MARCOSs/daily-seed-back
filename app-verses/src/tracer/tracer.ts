import { trace } from '@opentelemetry/api'

if (!process.env.OTEL_SERVICE_NAME) {
    throw new Error('Otel name is not defined')
}

export const tracer = trace.getTracer(process.env.OTEL_SERVICE_NAME)