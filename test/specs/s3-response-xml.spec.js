import { ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3'
import { HttpResponse } from '@smithy/protocol-http'
import { afterEach, describe, expect, it, vi } from 'vitest'

const clients = []

const createClient = (statusCode, xml) => {
  const requestHandler = {
    handle: vi.fn(async () => ({
      response: new HttpResponse({
        statusCode,
        headers: { 'content-type': 'application/xml' },
        body: Buffer.from(xml),
      }),
    })),
    destroy: vi.fn(),
  }

  const client = new S3Client({
    region: 'us-east-1',
    endpoint: 'https://s3.example.test',
    forcePathStyle: true,
    credentials: {
      accessKeyId: 'TESTACCESSKEY',
      secretAccessKey: 'test-secret-key',
    },
    requestHandler,
  })

  clients.push(client)
  return { client, requestHandler }
}

afterEach(() => {
  for (const client of clients) {
    client.destroy()
  }
  clients.length = 0
})

describe('S3 XML responses', () => {
  it('deserializes a successful ListObjectsV2 XML response through the injected handler', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
        <Name>payment-test</Name>
        <Prefix/>
        <KeyCount>1</KeyCount>
        <MaxKeys>1000</MaxKeys>
        <IsTruncated>false</IsTruncated>
        <Contents>
          <Key>10836_document.pdf</Key>
          <LastModified>2026-11-16T10:00:00.000Z</LastModified>
          <ETag>&quot;test-etag&quot;</ETag>
          <Size>42</Size>
          <StorageClass>STANDARD</StorageClass>
        </Contents>
      </ListBucketResult>`
    const { client, requestHandler } = createClient(200, xml)

    const result = await client.send(new ListObjectsV2Command({ Bucket: 'payment-test' }))

    expect(result.Name).toBe('payment-test')
    expect(result.Contents).toEqual([
      expect.objectContaining({
        Key: '10836_document.pdf',
        Size: 42,
        StorageClass: 'STANDARD',
      }),
    ])
    expect(requestHandler.handle).toHaveBeenCalledTimes(1)
  })

  it('deserializes an S3 XML error response through the injected handler', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <Error>
        <Code>NoSuchBucket</Code>
        <Message>The specified bucket does not exist</Message>
        <BucketName>missing-payment-test</BucketName>
        <RequestId>synthetic-request-id</RequestId>
        <HostId>synthetic-host-id</HostId>
      </Error>`
    const { client, requestHandler } = createClient(404, xml)

    await expect(client.send(new ListObjectsV2Command({ Bucket: 'missing-payment-test' }))).rejects.toMatchObject({
      name: 'NoSuchBucket',
      $metadata: { httpStatusCode: 404 },
    })
    expect(requestHandler.handle).toHaveBeenCalledTimes(1)
  })
})
